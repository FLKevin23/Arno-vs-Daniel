/**
 * Pure Telegram-login logic. No Firebase imports and no side effects, so it can
 * be exercised directly by the test script — this is the code that decides
 * whether a login is genuine, so it should never be taken on trust.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type Side = "arno" | "daniel";

/** A Telegram login is only accepted for this long (handoff §1.1). */
export const MAX_AUTH_AGE_SECONDS = 86_400;

/** Fields the Telegram Login Widget is documented to send. */
export const TELEGRAM_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
] as const;

/**
 * Name tokens that identify each camp. Matched as whole tokens, so "Arnold" is
 * not an Arno while "@arno_almagro" is. Add nicknames here if the group has one
 * this misses — it is the only place the mapping lives.
 */
export const ARNO_TOKENS = new Set(["arno"]);
export const DANIEL_TOKENS = new Set(["daniel", "daniela", "dani", "danny"]);

export interface TelegramPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

export type VerifyFailure =
  | "unexpected-field"
  | "bad-hash"
  | "malformed"
  | "expired";

export class TelegramVerificationError extends Error {
  constructor(public readonly reason: VerifyFailure, message: string) {
    super(message);
    this.name = "TelegramVerificationError";
  }
}

/** Split names into lowercase letter-only tokens: "Arno_Al-Paczino" -> [arno, al, paczino] */
export function tokenize(...parts: Array<string | undefined>): string[] {
  return parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .flatMap((p) => p.toLowerCase().split(/[^a-zà-ÿ]+/u))
    .filter((t) => t.length > 0);
}

/**
 * Derive the camp from the Telegram-verified name (handoff §1.2: side is never
 * free input). Returns null when the name identifies neither camp — or both,
 * which would otherwise let an "Arno Daniel" choose by hand.
 */
export function deriveSide(firstName?: string, lastName?: string, username?: string): Side | null {
  const tokens = tokenize(firstName, lastName, username);
  const isArno = tokens.some((t) => ARNO_TOKENS.has(t));
  const isDaniel = tokens.some((t) => DANIEL_TOKENS.has(t));
  if (isArno === isDaniel) return null; // neither, or ambiguously both
  return isArno ? "arno" : "daniel";
}

/** "@arno_almagro" -> "@arn***" (S5: the raw handle is never public). */
export function maskHandle(username: string, firstName: string): string {
  const base = username.length > 0 ? username : firstName;
  if (base.length === 0) return "@***";
  return "@" + base.slice(0, 3).toLowerCase() + "***";
}

/** The exact string Telegram signs: every received field except `hash`, sorted. */
export function buildCheckString(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .filter(([k]) => k !== "hash")
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

/** Sign a payload the way Telegram does. Used by the test script. */
export function signPayload(payload: Record<string, unknown>, botToken: string): string {
  const secret = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secret).update(buildCheckString(payload)).digest("hex");
}

/**
 * Throw unless the payload genuinely came from Telegram and is still fresh.
 * secret = SHA256(bot_token); hash = HMAC_SHA256(secret, sorted "k=v\n…").
 */
export function verifyTelegramPayload(
  payload: TelegramPayload,
  botToken: string,
  now: number = Date.now(),
): void {
  for (const key of Object.keys(payload)) {
    if (key !== "hash" && !(TELEGRAM_FIELDS as readonly string[]).includes(key)) {
      throw new TelegramVerificationError("unexpected-field", "Unexpected field in login payload.");
    }
  }

  const expected = signPayload(payload as unknown as Record<string, unknown>, botToken);
  const given = String(payload.hash ?? "");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TelegramVerificationError("bad-hash", "Login could not be verified.");
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) {
    throw new TelegramVerificationError("malformed", "Malformed login payload.");
  }
  const ageSeconds = Math.floor(now / 1000) - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -300) {
    throw new TelegramVerificationError("expired", "This login has expired. Please sign in again.");
  }
}
