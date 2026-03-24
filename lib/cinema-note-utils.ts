export const NOTE_PALETTE = [
  { hex: "#ffffff", label: "White" },
  { hex: "#ff3b30", label: "Red" },
  { hex: "#ffd60a", label: "Yellow" },
  { hex: "#30d158", label: "Green" },
  { hex: "#0a84ff", label: "Blue" },
] as const;

export type NotePaletteHex = (typeof NOTE_PALETTE)[number]["hex"];

export function normalizeHex(input: string): string {
  let h = input.trim().toLowerCase();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  const m = /^#?([0-9a-f]{6})$/.exec(h.replace("#", ""));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channelToLinear(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance 0–1 */
export function relativeLuminance(r: number, g: number, b: number) {
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** 마커 원 배경 위에 올릴 숫자 색 — 밝은 배경이면 검정, 어두우면 흰색 */
export function markerNumberTextColor(bgHex: string): "#000000" | "#ffffff" {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#000000";
  const L = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return L > 0.55 ? "#000000" : "#ffffff";
}
