import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase.js";
import { TELEGRAM_BOT_USERNAME } from "./config.js";
import type { Session, Side } from "./types.js";

/** Versioned so a shape change can never read a stale cache (S13). */
const SESSION_CACHE_KEY = "avd:v2:session";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TgAuthResult {
  token: string;
  side: Side | null;
  handleMasked: string;
  displayName: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function isTelegramConfigured(): boolean {
  return TELEGRAM_BOT_USERNAME.trim().length > 0;
}

/**
 * Drop the Telegram Login Widget into `container`. Telegram calls back into a
 * global, so we install one just before injecting the script.
 */
export function mountTelegramWidget(container: HTMLElement, onAuth: (user: TelegramUser) => void): void {
  container.replaceChildren();
  window.onTelegramAuth = onAuth;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
  script.setAttribute("data-size", "large");
  script.setAttribute("data-radius", "10");
  script.setAttribute("data-userpic", "false");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  container.appendChild(script);
}

/**
 * Exchange a verified widget payload for a Firebase session.
 * Every field is checked server-side; nothing here is trusted.
 */
export async function signInWithTelegram(user: TelegramUser): Promise<Session> {
  const call = httpsCallable<TelegramUser, TgAuthResult>(functions(), "tgAuth");
  const { data } = await call(user);

  const credential = await signInWithCustomToken(auth(), data.token);

  const session: Session = {
    uid: credential.user.uid,
    side: data.side,
    handleMasked: data.handleMasked,
    displayName: data.displayName,
  };
  cacheSession(session);
  return session;
}

export async function signOutNow(): Promise<void> {
  clearCachedSession();
  await signOut(auth());
}

/**
 * Observe sign-in state. Firebase restores the session on reload, but the
 * derived side/handle came from the one-off tgAuth response, so it is cached
 * locally and replayed. A missing cache is harmless: the server re-derives the
 * side on every castVote anyway.
 */
export function observeSession(onChange: (session: Session | null) => void): () => void {
  return onAuthStateChanged(auth(), (user: User | null) => {
    if (!user) {
      onChange(null);
      return;
    }
    const cached = readCachedSession();
    onChange(
      cached && cached.uid === user.uid
        ? cached
        : { uid: user.uid, side: null, handleMasked: "@***", displayName: "You" },
    );
  });
}

function cacheSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
  } catch {
    // Private window or blocked storage: the session still works for this visit.
  }
}

function clearCachedSession(): void {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // ignore
  }
}

function readCachedSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Session>;
    if (typeof candidate.uid !== "string" || typeof candidate.handleMasked !== "string") return null;
    const side = candidate.side === "arno" || candidate.side === "daniel" ? candidate.side : null;
    return {
      uid: candidate.uid,
      side,
      handleMasked: candidate.handleMasked,
      displayName: typeof candidate.displayName === "string" ? candidate.displayName : "You",
    };
  } catch {
    return null;
  }
}
