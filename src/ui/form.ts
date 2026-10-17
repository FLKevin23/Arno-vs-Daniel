import { SIDE_LABEL, type Session } from "../types.js";

export interface VotePanelState {
  readonly session: Session | null;
  readonly hasVoted: boolean;
  readonly busy: boolean;
  readonly telegramConfigured: boolean;
}

interface PanelElements {
  hint: HTMLElement;
  widget: HTMLElement;
  actions: HTMLElement;
  whoami: HTMLElement;
  cast: HTMLButtonElement;
  remove: HTMLButtonElement;
  signOut: HTMLButtonElement;
}

function elements(): PanelElements {
  const get = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing #${id}`);
    return node as T;
  };
  return {
    hint: get("vote-hint"),
    widget: get("tg-widget"),
    actions: get("vote-actions"),
    whoami: get("whoami"),
    cast: get<HTMLButtonElement>("cast"),
    remove: get<HTMLButtonElement>("remove"),
    signOut: get<HTMLButtonElement>("signout"),
  };
}

/**
 * Drive the vote panel. Five states: not configured, signed out, signed in but
 * not an Arno or a Daniel, eligible and unvoted, eligible and voted.
 */
export function renderVotePanel(state: VotePanelState): void {
  const el = elements();
  const { session, hasVoted, busy, telegramConfigured } = state;

  if (!telegramConfigured) {
    el.hint.textContent =
      "Telegram sign-in isn't configured yet, so voting is closed. The tally below is live.";
    el.widget.hidden = true;
    el.actions.hidden = true;
    return;
  }

  if (!session) {
    el.hint.textContent =
      "Sign in with Telegram to vote. Your side is taken from your Telegram name, so nobody can vote as someone else.";
    el.widget.hidden = false;
    el.actions.hidden = true;
    return;
  }

  el.widget.hidden = true;
  el.actions.hidden = false;
  el.signOut.disabled = busy;

  if (session.side === null) {
    el.hint.textContent = "You're signed in, but only Arnos and Daniels can vote.";
    el.whoami.textContent = `Signed in as ${session.handleMasked}. Your Telegram name doesn't identify you as an Arno or a Daniel, so you can watch but not vote.`;
    el.cast.hidden = true;
    el.remove.hidden = true;
    return;
  }

  const sideLabel = SIDE_LABEL[session.side];
  el.cast.hidden = hasVoted;
  el.remove.hidden = !hasVoted;
  el.cast.disabled = busy;
  el.remove.disabled = busy;

  if (hasVoted) {
    el.hint.textContent = "Your vote is counted.";
    el.whoami.textContent = `Signed in as ${session.handleMasked}, counted as ${sideLabel}.`;
    el.remove.textContent = busy ? "Removing…" : "Remove my vote";
  } else {
    el.hint.textContent = `Telegram says you're ${sideLabel}. One tap and you're counted.`;
    el.whoami.textContent = `Signed in as ${session.handleMasked}, recognised as ${sideLabel}.`;
    el.cast.textContent = busy ? "Counting…" : `Count me as ${sideLabel}`;
  }
}
