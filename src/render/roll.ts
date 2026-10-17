import type { Side, VoteRecord } from "../types.js";

/**
 * The public roll. Built entirely with createElement/textContent (S7): no
 * dynamic value ever reaches the HTML parser, so a hostile stored string is
 * displayed rather than executed.
 */
export function renderRoll(
  list: HTMLUListElement,
  countEl: HTMLElement,
  emptyEl: HTMLElement,
  records: readonly VoteRecord[],
  currentUid: string | null,
): void {
  countEl.textContent = String(records.length);
  emptyEl.hidden = records.length > 0;

  const items = records.map((record) => {
    const li = document.createElement("li");

    const handle = document.createElement("span");
    handle.className = "h";
    handle.textContent = record.handleMasked;
    li.appendChild(handle);

    if (record.uid === currentUid) {
      const you = document.createElement("span");
      you.className = "you";
      you.textContent = "you";
      li.appendChild(you);
    }

    return li;
  });

  list.replaceChildren(...items);
}

export function rollElements(side: Side): {
  list: HTMLUListElement;
  count: HTMLElement;
  empty: HTMLElement;
} {
  const list = document.getElementById(`roll-${side}`);
  const count = document.getElementById(`roll-count-${side}`);
  const empty = document.getElementById(`none-${side}`);
  if (!(list instanceof HTMLUListElement) || !count || !empty) {
    throw new Error(`Missing roll elements for ${side}`);
  }
  return { list, count, empty };
}
