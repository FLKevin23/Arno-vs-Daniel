export type MsgKind = "ok" | "err" | "info";

/** Status line under the vote controls. aria-live, textContent only (S7). */
export function setMsg(message: string, kind: MsgKind = "info"): void {
  const node = document.getElementById("msg");
  if (!node) return;
  node.textContent = message;
  node.className = `msg ${kind}`;
}

export function clearMsg(): void {
  setMsg("", "info");
}
