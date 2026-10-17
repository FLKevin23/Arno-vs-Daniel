/** Notices. textContent only (S7) — banners carry server and error strings. */

const el = (): HTMLElement => {
  const node = document.getElementById("banner");
  if (!node) throw new Error("Missing #banner");
  return node;
};

const textEl = (): HTMLElement => {
  const node = document.getElementById("banner-text");
  if (!node) throw new Error("Missing #banner-text");
  return node;
};

export function showBanner(message: string): void {
  textEl().textContent = message;
  el().hidden = false;
}

export function hideBanner(): void {
  el().hidden = true;
}
