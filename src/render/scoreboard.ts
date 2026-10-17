import type { Tally } from "../types.js";

interface ScoreboardElements {
  readonly countArno: HTMLElement;
  readonly countDaniel: HTMLElement;
  readonly pctArno: HTMLElement;
  readonly pctDaniel: HTMLElement;
  readonly tileArno: HTMLElement;
  readonly tileDaniel: HTMLElement;
  readonly total: HTMLElement;
  readonly legendArno: HTMLElement;
  readonly legendDaniel: HTMLElement;
  readonly emptyNote: HTMLElement;
}

export function renderScoreboard(el: ScoreboardElements, tally: Tally): void {
  const a = tally.arno.length;
  const d = tally.daniel.length;
  const total = tally.total;

  const pctArno = total > 0 ? Math.round((a / total) * 100) : 0;
  const pctDaniel = total > 0 ? 100 - pctArno : 0;

  el.countArno.textContent = String(a);
  el.countDaniel.textContent = String(d);
  el.pctArno.textContent = total > 0 ? `${pctArno}%` : "—";
  el.pctDaniel.textContent = total > 0 ? `${pctDaniel}%` : "—";
  el.total.textContent = String(total);
  el.legendArno.textContent = `${a} · ${pctArno}%`;
  el.legendDaniel.textContent = `${d} · ${pctDaniel}%`;

  el.tileArno.classList.toggle("lead", a > d);
  el.tileDaniel.classList.toggle("lead", d > a);
  el.emptyNote.hidden = total > 0;
}
