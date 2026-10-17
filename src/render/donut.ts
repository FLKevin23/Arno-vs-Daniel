import { SIDE_LABEL, type Side } from "../types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Geometry carried over from v1: radius 72, stroke 26, 2px gap between slices. */
const RADIUS = 72;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 4;

export function renderDonut(group: SVGGElement, counts: Readonly<Record<Side, number>>): void {
  group.replaceChildren();

  const total = counts.arno + counts.daniel;
  if (total === 0) return;

  const gap = counts.arno > 0 && counts.daniel > 0 ? GAP : 0;
  let offset = 0;

  for (const side of ["arno", "daniel"] as const) {
    const n = counts[side];
    if (n === 0) continue;

    const share = n / total;
    const length = Math.max(share * CIRCUMFERENCE - gap, 1);

    const arc = document.createElementNS(SVG_NS, "circle");
    arc.setAttribute("cx", "100");
    arc.setAttribute("cy", "100");
    arc.setAttribute("r", String(RADIUS));
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", `var(--${side})`);
    arc.setAttribute("stroke-width", String(STROKE));
    arc.setAttribute("stroke-dasharray", `${length} ${CIRCUMFERENCE - length}`);
    arc.setAttribute("stroke-dashoffset", String(-(offset + gap / 2)));
    arc.setAttribute("class", "donut-seg");

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${SIDE_LABEL[side]}: ${n} (${Math.round(share * 100)}%)`;
    arc.appendChild(title);

    group.appendChild(arc);
    offset += share * CIRCUMFERENCE;
  }
}
