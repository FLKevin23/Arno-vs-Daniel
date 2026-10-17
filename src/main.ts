import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";

import { isTelegramConfigured, mountTelegramWidget, observeSession, signInWithTelegram, signOutNow } from "./auth.js";
import { castVote, deleteMyVote, observeVotes } from "./store.js";
import { renderDonut } from "./render/donut.js";
import { renderScoreboard } from "./render/scoreboard.js";
import { renderRoll, rollElements } from "./render/roll.js";
import { renderVotePanel } from "./ui/form.js";
import { hideBanner, showBanner } from "./ui/banner.js";
import { clearMsg, setMsg } from "./ui/msg.js";
import { SIDE_LABEL, type Session, type Tally } from "./types.js";

const required = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
};

const dom = {
  countArno: required("count-arno"),
  countDaniel: required("count-daniel"),
  pctArno: required("pct-arno"),
  pctDaniel: required("pct-daniel"),
  tileArno: required("tile-arno"),
  tileDaniel: required("tile-daniel"),
  total: required("total"),
  legendArno: required("leg-arno"),
  legendDaniel: required("leg-daniel"),
  emptyNote: required("empty-note"),
  segments: document.getElementById("segments") as SVGGElement | null,
  loading: required("loading"),
};

let session: Session | null = null;
let tally: Tally = { arno: [], daniel: [], total: 0 };
let busy = false;
let loaded = false;

function hasVoted(): boolean {
  if (!session) return false;
  return [...tally.arno, ...tally.daniel].some((record) => record.uid === session?.uid);
}

function render(): void {
  renderScoreboard(dom, tally);

  if (dom.segments) {
    renderDonut(dom.segments, { arno: tally.arno.length, daniel: tally.daniel.length });
  }

  for (const side of ["arno", "daniel"] as const) {
    const { list, count, empty } = rollElements(side);
    renderRoll(list, count, empty, tally[side], session?.uid ?? null);
  }

  renderVotePanel({
    session,
    hasVoted: hasVoted(),
    busy,
    telegramConfigured: isTelegramConfigured(),
  });

  dom.loading.hidden = loaded;
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  busy = true;
  render();
  try {
    await action();
  } finally {
    busy = false;
    render();
  }
}

/** Callable errors carry a readable `message`; anything else gets a generic line. */
function describe(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    return message.replace(/^.*?\/\s*/, "").trim() || "Something went wrong.";
  }
  return "Something went wrong.";
}

function wireButtons(): void {
  required<HTMLButtonElement>("cast").addEventListener("click", () => {
    void withBusy(async () => {
      try {
        const { side } = await castVote();
        setMsg(`Counted as ${SIDE_LABEL[side]}. Thanks!`, "ok");
      } catch (error) {
        setMsg(describe(error), "err");
      }
    });
  });

  required<HTMLButtonElement>("remove").addEventListener("click", () => {
    void withBusy(async () => {
      try {
        await deleteMyVote();
        setMsg("Your vote has been removed.", "ok");
      } catch (error) {
        setMsg(describe(error), "err");
      }
    });
  });

  required<HTMLButtonElement>("signout").addEventListener("click", () => {
    void withBusy(async () => {
      await signOutNow();
      clearMsg();
    });
  });
}

function startTelegram(): void {
  if (!isTelegramConfigured()) return;
  mountTelegramWidget(required("tg-widget"), (user) => {
    void withBusy(async () => {
      try {
        session = await signInWithTelegram(user);
        hideBanner();
        setMsg(
          session.side
            ? `Signed in. Telegram says you're ${SIDE_LABEL[session.side]}.`
            : "Signed in. Your Telegram name doesn't identify you as an Arno or a Daniel.",
          session.side ? "ok" : "info",
        );
      } catch (error) {
        setMsg(describe(error), "err");
      }
    });
  });
}

function boot(): void {
  render();

  observeVotes(
    (next) => {
      tally = next;
      loaded = true;
      hideBanner();
      render();
    },
    (error) => {
      loaded = true;
      showBanner(`The tally couldn't be loaded. ${describe(error)}`);
      render();
    },
  );

  observeSession((next) => {
    session = next;
    render();
    if (!next) startTelegram();
  });

  wireButtons();
  startTelegram();
}

boot();
