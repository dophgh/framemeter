import { FC_MAP } from "@/lib/cinema-constants";
import type { CinemaPage } from "@/lib/cinema-types";

export function defMeta() {
  return {
    title: "",
    dir: "",
    dp: "",
    loc: "",
    dn: "",
    size: "",
    type: "",
    level: "",
    move: "",
    color: "",
    lens: "",
    camera: "",
    lenses: "",
  };
}

export function lm(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function fc(l: number): [number, number, number] {
  const ire = (l / 255) * 109;
  for (const f of FC_MAP) {
    if (ire <= f.m) return [f.r, f.g, f.b];
  }
  return [255, 255, 255];
}

export function computePaletteRgbKeys(
  px: ImageData,
  W: number,
  H: number,
): string[] {
  const step = Math.max(4, Math.floor((W * H) / 800));
  const bk: Record<string, number> = {};
  for (let i = 0; i < px.data.length; i += 4 * step) {
    const r = Math.round(px.data[i] / 20) * 20;
    const g = Math.round(px.data[i + 1] / 20) * 20;
    const b = Math.round(px.data[i + 2] / 20) * 20;
    const k = `${r},${g},${b}`;
    bk[k] = (bk[k] || 0) + 1;
  }
  return Object.entries(bk)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);
}

export function drawOrigAndGrid(
  oc: HTMLCanvasElement,
  gc: HTMLCanvasElement,
  p: CinemaPage,
) {
  if (!p.imgEl || !p.px) return;
  const { W, H } = p;
  oc.width = W;
  oc.height = H;
  gc.width = W;
  gc.height = H;
  oc.getContext("2d")!.drawImage(p.imgEl, 0, 0);
  const gx = gc.getContext("2d")!;
  gx.drawImage(p.imgEl, 0, 0);
  gx.strokeStyle = "rgba(255,255,255,0.6)";
  gx.lineWidth = Math.max(1, W / 700);
  for (let i = 1; i < 3; i++) {
    gx.beginPath();
    gx.moveTo((W * i) / 3, 0);
    gx.lineTo((W * i) / 3, H);
    gx.stroke();
    gx.beginPath();
    gx.moveTo(0, (H * i) / 3);
    gx.lineTo(W, (H * i) / 3);
    gx.stroke();
  }
}

export function drawFalseColorCanvas(
  fcc: HTMLCanvasElement,
  p: CinemaPage,
) {
  if (!p.px) return;
  const { W, H } = p;
  fcc.width = W;
  fcc.height = H;
  const fx = fcc.getContext("2d")!;
  const fd = fx.createImageData(W, H);
  const d = p.px.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = fc(lm(d[i], d[i + 1], d[i + 2]));
    fd.data[i] = r;
    fd.data[i + 1] = g;
    fd.data[i + 2] = b;
    fd.data[i + 3] = 255;
  }
  fx.putImageData(fd, 0, 0);
}

export function drawWF(p: CinemaPage, c: HTMLCanvasElement) {
  if (!p.px) return;
  const CW = c.clientWidth || 360;
  const CH = c.clientHeight || 160;
  c.width = Math.max(CW, 240);
  c.height = Math.max(CH, 120);
  const cx = c.getContext("2d")!;
  cx.fillStyle = "#050505";
  cx.fillRect(0, 0, c.width, c.height);
  cx.strokeStyle = "rgba(255,148,0,0.18)";
  cx.lineWidth = 0.5;
  cx.font = "7px Space Mono,monospace";
  cx.fillStyle = "rgba(255,148,0,0.45)";
  [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].forEach((v) => {
    const y = c.height - (v / 100) * c.height;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(c.width, y);
    cx.stroke();
    cx.fillText(String(v), 2, y - 2);
  });
  const st = Math.max(1, Math.floor(p.H / 140));
  cx.fillStyle = "rgba(155,200,255,0.08)";
  const { W, H } = p;
  const d = p.px.data;
  for (let x = 0; x < W; x++) {
    const pxCol = Math.floor((x / W) * c.width);
    for (let y = 0; y < H; y += st) {
      const i = (y * W + x) * 4;
      const l = lm(d[i], d[i + 1], d[i + 2]);
      cx.fillRect(pxCol, c.height - (l / 255) * c.height, 1, 1);
    }
  }
}

export function drawVS(p: CinemaPage, c: HTMLCanvasElement) {
  if (!p.px) return;
  const S = Math.min(c.clientWidth || 190, c.clientHeight || 190, 190);
  c.width = S;
  c.height = S;
  const cx = c.getContext("2d")!;
  const ox = S / 2;
  const oy = S / 2;
  const r = S / 2 - 10;
  cx.fillStyle = "#050505";
  cx.fillRect(0, 0, S, S);
  cx.strokeStyle = "rgba(255,148,0,0.22)";
  cx.lineWidth = 0.5;
  [1, 0.66, 0.33].forEach((f) => {
    cx.beginPath();
    cx.arc(ox, oy, r * f, 0, Math.PI * 2);
    cx.stroke();
  });
  cx.beginPath();
  cx.moveTo(ox - r, oy);
  cx.lineTo(ox + r, oy);
  cx.stroke();
  cx.beginPath();
  cx.moveTo(ox, oy - r);
  cx.lineTo(ox, oy + r);
  cx.stroke();
  cx.font = "8px Space Mono,monospace";
  cx.fillStyle = "rgba(255,148,0,0.65)";
  [
    { t: "R", a: 0 },
    { t: "M", a: 60 },
    { t: "B", a: 120 },
    { t: "C", a: 180 },
    { t: "G", a: 240 },
    { t: "Y", a: 300 },
  ].forEach(({ t, a }) => {
    const rd = ((a - 90) * Math.PI) / 180;
    cx.fillText(t, ox + (r + 8) * Math.cos(rd) - 3, oy + (r + 8) * Math.sin(rd) + 3);
  });
  const st = Math.max(1, Math.floor((p.W * p.H) / 10000));
  const d = p.px.data;
  for (let i = 0; i < d.length; i += 4 * st) {
    const rr = d[i] / 255;
    const gg = d[i + 1] / 255;
    const bb = d[i + 2] / 255;
    const cb = -0.169 * rr - 0.331 * gg + 0.5 * bb;
    const cr = 0.5 * rr - 0.419 * gg - 0.081 * bb;
    const al = Math.min(0.75, 0.06 + Math.sqrt(cb * cb + cr * cr) * 3);
    cx.fillStyle = `rgba(255,255,255,${al.toFixed(2)})`;
    cx.fillRect(ox + cb * r * 2.6, oy - cr * r * 2.6, 1, 1);
  }
}
