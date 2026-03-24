export const FC_MAP = [
  { m: 2, r: 75, g: 0, b: 130 },
  { m: 8, r: 0, g: 0, b: 180 },
  { m: 15, r: 0, g: 120, b: 180 },
  { m: 24, r: 0, g: 160, b: 160 },
  { m: 43, r: 100, g: 100, b: 100 },
  { m: 47, r: 80, g: 180, b: 80 },
  { m: 54, r: 120, g: 120, b: 120 },
  { m: 58, r: 240, g: 160, b: 150 },
  { m: 77, r: 200, g: 200, b: 200 },
  { m: 84, r: 230, g: 230, b: 180 },
  { m: 93, r: 255, g: 255, b: 0 },
  { m: 100, r: 255, g: 140, b: 0 },
  { m: 109, r: 220, g: 0, b: 0 },
] as const;

export const IRE_VALS = FC_MAP.map((v) => v.m);

const BAND_MINS = [-7, ...IRE_VALS.slice(0, -1)];

function pickFg(r: number, g: number, b: number) {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l >= 150 ? "#111" : "#f2f2f2";
}

function stopLabelForRange(minIre: number, maxIre: number) {
  const baseIre = 45; // 43~47 mid
  const midIre = Math.max(0.1, (minIre + maxIre) / 2);
  const ev = 2.2 * Math.log2(midIre / baseIre);
  const rounded = Math.round(ev * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

export const IRE_BANDS = FC_MAP.map((c, i) => {
  const min = BAND_MINS[i];
  const max = c.m;
  return {
    min,
    max,
    r: c.r,
    g: c.g,
    b: c.b,
    bg: `rgb(${c.r},${c.g},${c.b})`,
    fg: pickFg(c.r, c.g, c.b),
    stop: stopLabelForRange(min, max),
    label: `${min}-${max}`,
  };
});

export const IRE_BG = IRE_BANDS.map((b) => b.bg);
export const IRE_FG = IRE_BANDS.map((b) => b.fg);
