import { jsPDF } from "jspdf";
import { IRE_BG, IRE_FG, IRE_VALS } from "@/lib/cinema-constants";
import { fc, lm } from "@/lib/cinema-analysis";
import { markerNumberTextColor, normalizeHex } from "@/lib/cinema-note-utils";
import type { CinemaPage, FilmMeta } from "@/lib/cinema-types";

const PW = 1920;
const PH = 1080;

function drawHdrBar(ctx: CanvasRenderingContext2D, m: FilmMeta, width: number, H: number) {
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, width, H);
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(width, H);
  ctx.stroke();
  ctx.font = "11px Space Mono,monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const parts = [
    { lbl: "", val: m.title ? `< ${m.title} >` : "< FILM TITLE >" },
    { lbl: "Location : ", val: m.loc || "—" },
    { lbl: "D/N : ", val: m.dn || "—" },
    { lbl: "Size : ", val: m.size || "—" },
    { lbl: "Type : ", val: m.type || "—" },
    { lbl: "Level : ", val: m.level || "—" },
    { lbl: "Move : ", val: m.move || "—" },
    { lbl: "Color : ", val: m.color || "—" },
    { lbl: "Lens : ", val: m.lens || "—" },
    { lbl: "Camera : ", val: m.camera || "—" },
    { lbl: "Dir : ", val: m.dir || "—" },
    { lbl: "DP : ", val: m.dp || "—" },
  ];
  let x = 14;
  parts.forEach(({ lbl, val }) => {
    if (lbl) {
      ctx.fillStyle = "#888";
      ctx.fillText(lbl, x, H / 2);
      x += ctx.measureText(lbl).width;
    }
    ctx.fillStyle = "#ddd";
    ctx.fillText(val, x, H / 2);
    x += ctx.measureText(val).width + 18;
  });
}

function drawMetaBar(ctx: CanvasRenderingContext2D, _m: FilmMeta, width: number, y: number, H: number) {
  ctx.fillStyle = "#040404";
  ctx.fillRect(0, y, width, H);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + H);
  ctx.lineTo(width, y + H);
  ctx.stroke();
}

function drawIREbar(ctx: CanvasRenderingContext2D, width: number, y: number, H: number) {
  const n = IRE_VALS.length;
  const cw = Math.floor(width / n);
  IRE_VALS.forEach((v, i) => {
    const x = i * cw;
    ctx.fillStyle = IRE_BG[i];
    ctx.fillRect(x, y, cw, H);
    ctx.font = "8px Space Mono,monospace";
    ctx.fillStyle = IRE_FG[i];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(v), x + cw / 2, y + H / 2);
  });
}

function drawScopeLabel(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number) {
  ctx.font = "8px Space Mono,monospace";
  ctx.fillStyle = "#2a2a2a";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(txt, x + 6, y + 4);
}

function drawPalette(
  ctx: CanvasRenderingContext2D,
  p: CinemaPage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!p.px) return;
  const step = Math.max(4, Math.floor((p.W * p.H) / 800));
  const bk: Record<string, number> = {};
  const d = p.px.data;
  for (let i = 0; i < d.length; i += 4 * step) {
    const r = Math.round(d[i] / 20) * 20;
    const g = Math.round(d[i + 1] / 20) * 20;
    const b = Math.round(d[i + 2] / 20) * 20;
    const k = `${r},${g},${b}`;
    bk[k] = (bk[k] || 0) + 1;
  }
  const top = Object.entries(bk)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const sw = Math.floor(h / top.length);
  top.forEach(([k], i) => {
    ctx.fillStyle = `rgb(${k})`;
    ctx.fillRect(x, y + i * sw, w, sw);
  });
}

async function buildFCCanvas(p: CinemaPage) {
  if (!p.px) return document.createElement("canvas");
  const c = document.createElement("canvas");
  c.width = p.W;
  c.height = p.H;
  const fx = c.getContext("2d")!;
  const fd = fx.createImageData(p.W, p.H);
  const d = p.px.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = fc(lm(d[i], d[i + 1], d[i + 2]));
    fd.data[i] = r;
    fd.data[i + 1] = g;
    fd.data[i + 2] = b;
    fd.data[i + 3] = 255;
  }
  fx.putImageData(fd, 0, 0);
  return c;
}

async function buildWFCanvas(p: CinemaPage, W: number, H: number) {
  if (!p.px) return document.createElement("canvas");
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const cx = c.getContext("2d")!;
  cx.fillStyle = "#050505";
  cx.fillRect(0, 0, W, H);
  cx.strokeStyle = "rgba(255,148,0,0.2)";
  cx.lineWidth = 0.5;
  cx.font = "8px Space Mono,monospace";
  cx.fillStyle = "rgba(255,148,0,0.5)";
  [0, 25, 50, 75, 100].forEach((v) => {
    const y = H - (v / 100) * H;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(W, y);
    cx.stroke();
    cx.fillText(String(v), 2, y - 2);
  });
  const st = Math.max(1, Math.floor(p.H / 200));
  cx.fillStyle = "rgba(155,200,255,0.09)";
  const d = p.px.data;
  for (let x = 0; x < p.W; x++) {
    const px2 = Math.floor((x / p.W) * W);
    for (let y = 0; y < p.H; y += st) {
      const i = (y * p.W + x) * 4;
      const l = lm(d[i], d[i + 1], d[i + 2]);
      cx.fillRect(px2, H - (l / 255) * H, 1, 1);
    }
  }
  return c;
}

async function buildVSCanvas(p: CinemaPage, W: number, H: number) {
  if (!p.px) return document.createElement("canvas");
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const cx = c.getContext("2d")!;
  const ox = W / 2;
  const oy = H / 2;
  const r = Math.min(W, H) / 2 - 12;
  cx.fillStyle = "#050505";
  cx.fillRect(0, 0, W, H);
  cx.strokeStyle = "rgba(255,148,0,0.25)";
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
  cx.font = "9px Space Mono,monospace";
  cx.fillStyle = "rgba(255,148,0,0.7)";
  cx.textAlign = "center";
  cx.textBaseline = "middle";
  [
    { t: "R", a: 0 },
    { t: "M", a: 60 },
    { t: "B", a: 120 },
    { t: "C", a: 180 },
    { t: "G", a: 240 },
    { t: "Y", a: 300 },
  ].forEach(({ t, a }) => {
    const rd = ((a - 90) * Math.PI) / 180;
    cx.fillText(t, ox + (r + 11) * Math.cos(rd), oy + (r + 11) * Math.sin(rd));
  });
  const st = Math.max(1, Math.floor((p.W * p.H) / 12000));
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
  return c;
}

async function buildDataCanvas(p: CinemaPage, width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  if (!p.imgEl || !p.px) return c;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const TOPBAR = 34;
  const METAH = 22;
  const topSectionH = Math.floor(height * 0.5);
  const bottomSectionH = height - TOPBAR - METAH - topSectionH;
  const scopeLabelH = 16;
  const IREH = 22;

  drawHdrBar(ctx, p.meta, width, TOPBAR);
  drawMetaBar(ctx, p.meta, width, TOPBAR, METAH);

  const yTop = TOPBAR + METAH;
  const halfW = Math.floor(width / 2);
  const paletteW = 18;
  const topPad = 8;
  const usableTopH = topSectionH - topPad * 2;

  const leftX = 0;
  const leftW = halfW;
  const leftImgW = leftW - paletteW;
  const leftScale = Math.min(leftImgW / p.W, usableTopH / p.H);
  const leftDrawW = Math.floor(p.W * leftScale);
  const leftDrawH = Math.floor(p.H * leftScale);
  const leftImgX = leftX + Math.floor((leftImgW - leftDrawW) / 2);
  const leftImgY = yTop + Math.floor((usableTopH - leftDrawH) / 2) + topPad;
  ctx.drawImage(p.imgEl, leftImgX, leftImgY, leftDrawW, leftDrawH);
  drawPalette(ctx, p, leftX + leftW - paletteW, leftImgY, paletteW, leftDrawH);

  const rightX = halfW;
  const rightW = width - halfW;
  const rightScale = Math.min(rightW / p.W, usableTopH / p.H);
  const rightDrawW = Math.floor(p.W * rightScale);
  const rightDrawH = Math.floor(p.H * rightScale);
  const rightImgX = rightX + Math.floor((rightW - rightDrawW) / 2);
  const rightImgY = yTop + Math.floor((usableTopH - rightDrawH) / 2) + topPad;
  ctx.drawImage(p.imgEl, rightImgX, rightImgY, rightDrawW, rightDrawH);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(rightImgX + (rightDrawW * i) / 3, rightImgY);
    ctx.lineTo(rightImgX + (rightDrawW * i) / 3, rightImgY + rightDrawH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightImgX, rightImgY + (rightDrawH * i) / 3);
    ctx.lineTo(rightImgX + rightDrawW, rightImgY + (rightDrawH * i) / 3);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(halfW, yTop);
  ctx.lineTo(halfW, yTop + topSectionH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, yTop + topSectionH);
  ctx.lineTo(width, yTop + topSectionH);
  ctx.stroke();

  const scopeY = yTop + topSectionH;
  const scopeW = Math.floor(width / 3);
  const fcX = 0;
  const wfX = scopeW;
  const vsX = scopeW * 2;
  const vsW = width - vsX;

  const fcLabelY = scopeY + 2;
  const wfLabelY = scopeY + 2;
  const vsLabelY = scopeY + 2;
  drawScopeLabel(ctx, "FALSE COLOR", fcX, fcLabelY);
  drawScopeLabel(ctx, "WAVEFORM", wfX, wfLabelY);
  drawScopeLabel(ctx, "VECTORSCOPE", vsX, vsLabelY);

  const ireY = scopeY + scopeLabelH;
  drawIREbar(ctx, scopeW, ireY, IREH);

  const scopeInnerY = ireY + IREH + 4;
  const scopeInnerH = Math.max(20, bottomSectionH - scopeLabelH - IREH - 8);

  const fcC = await buildFCCanvas(p);
  const fcScale = Math.min(scopeW / p.W, scopeInnerH / p.H);
  const fcDrawW = Math.floor(p.W * fcScale);
  const fcDrawH = Math.floor(p.H * fcScale);
  const fcDrawX = fcX + Math.floor((scopeW - fcDrawW) / 2);
  const fcDrawY = scopeInnerY + Math.floor((scopeInnerH - fcDrawH) / 2);
  ctx.drawImage(fcC, fcDrawX, fcDrawY, fcDrawW, fcDrawH);

  const wfC = await buildWFCanvas(p, scopeW, scopeInnerH);
  ctx.drawImage(wfC, wfX, scopeInnerY, scopeW, scopeInnerH);

  const vsSize = Math.min(vsW, scopeInnerH);
  const vsC = await buildVSCanvas(p, vsSize, vsSize);
  const vsDrawX = vsX + Math.floor((vsW - vsSize) / 2);
  const vsDrawY = scopeInnerY + Math.floor((scopeInnerH - vsSize) / 2);
  ctx.drawImage(vsC, vsDrawX, vsDrawY, vsSize, vsSize);

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wfX, scopeY);
  ctx.lineTo(wfX, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vsX, scopeY);
  ctx.lineTo(vsX, height);
  ctx.stroke();

  return c;
}

async function buildNoteCanvas(p: CinemaPage, width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  if (!p.imgEl) return c;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const TOPBAR = 34;
  const METAH = 22;
  const NOTE_H = Math.floor(height * 0.24);
  const IMG_H = height - TOPBAR - METAH - NOTE_H;

  drawHdrBar(ctx, p.meta, width, TOPBAR);
  drawMetaBar(ctx, p.meta, width, TOPBAR, METAH);

  const y0 = TOPBAR + METAH;
  const imgW = width;
  const imgH = IMG_H;
  const scale = Math.min(imgW / p.W, imgH / p.H);
  const dw = Math.floor(p.W * scale);
  const dh = Math.floor(p.H * scale);
  const ox = Math.floor((imgW - dw) / 2);
  ctx.drawImage(p.imgEl, ox, y0, dw, dh);

  const cw = p.drawOverlaySize?.w ?? 0;
  const ch = p.drawOverlaySize?.h ?? 0;
  const scaleXS = cw > 0 ? dw / cw : 1;
  const scaleYS = ch > 0 ? dh / ch : 1;

  if (p.markers.length) {
    p.markers.forEach((m) => {
      const mx = ox + Math.floor((m.x / 100) * dw);
      const my = y0 + Math.floor((m.y / 100) * dh);
      const fill = normalizeHex(m.color || "#ffffff");
      ctx.beginPath();
      ctx.arc(mx, my, 14, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 14px Space Mono,monospace";
      ctx.fillStyle = markerNumberTextColor(fill);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(m.n), mx, my);
    });
  }

  if (p.strokes?.length && cw > 0 && ch > 0) {
    p.strokes.forEach((s) => {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, s.width * scaleXS);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(ox + s.points[0].x * scaleXS, y0 + s.points[0].y * scaleYS);
      s.points.slice(1).forEach((pt) => {
        ctx.lineTo(ox + pt.x * scaleXS, y0 + pt.y * scaleYS);
      });
      ctx.stroke();
    });
  }

  if (p.textNotes?.length) {
    ctx.save();
    ctx.font = "bold 12px Space Mono,monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    p.textNotes.forEach((tn) => {
      const tx = ox + (tn.x / 100) * dw;
      const ty = y0 + (tn.y / 100) * dh;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = normalizeHex(tn.color || "#ffffff");
      ctx.fillText(tn.content || "", tx, ty);
    });
    ctx.restore();
  }

  const noteY = y0 + IMG_H;
  ctx.strokeStyle = "#282828";
  ctx.lineWidth = 1;
  ctx.strokeRect(20, noteY + 8, width - 40, NOTE_H - 16);
  ctx.font = "10px Space Mono,monospace";
  ctx.fillStyle = "#555";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("NOTE", 32, noteY + 18);

  if (p.markers.length) {
    p.markers.forEach((m, i) => {
      const ty = noteY + 38 + i * 22;
      if (ty > height - 20) return;
      ctx.beginPath();
      ctx.arc(28, ty + 6, 5, 0, Math.PI * 2);
      ctx.fillStyle = normalizeHex(m.color || "#ffffff");
      ctx.fill();
      ctx.font = "11px Space Mono,monospace";
      ctx.fillStyle = "#aaa";
      ctx.fillText(`${m.n})`, 40, ty);
      ctx.fillStyle = "#ddd";
      ctx.fillText(m.text || "", 65, ty);
    });
  } else if (!p.textNotes?.length) {
    ctx.fillStyle = "#333";
    ctx.font = "11px Space Mono,monospace";
    ctx.fillText("— no notes —", 32, noteY + 38);
  }

  return c;
}

function buildCoverCanvas(projectTitle: string, width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  const title = projectTitle.trim() || "PROJECT";
  const maxTextW = width - 160;
  let fontPx = 52;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  for (; fontPx >= 20; fontPx -= 2) {
    ctx.font = `bold ${fontPx}px Space Mono,monospace`;
    if (ctx.measureText(title).width <= maxTextW) break;
  }
  ctx.fillText(title, width / 2, height / 2 - 28);

  ctx.fillStyle = "#555555";
  ctx.font = "13px Space Mono,monospace";
  ctx.fillText("FRAME METER", width / 2, height / 2 + 28);

  ctx.fillStyle = "#333333";
  ctx.font = "11px Space Mono,monospace";
  ctx.fillText(new Date().toLocaleDateString("ko-KR"), width / 2, height / 2 + 56);

  return c;
}

export async function exportCinemaPdf(
  validPages: CinemaPage[],
  projectName: string,
  onProgress: (label: string) => void,
): Promise<string> {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [PW, PH],
    compress: true,
  });

  const cover = buildCoverCanvas(projectName, PW, PH);
  pdf.addImage(cover.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, PH);
  onProgress("⏳ 표지 생성…");
  await new Promise((r) => setTimeout(r, 10));

  for (let i = 0; i < validPages.length; i++) {
    const p = validPages[i];
    if (!p.imageURL) continue;

    const dc = await buildDataCanvas(p, PW, PH);
    pdf.addPage([PW, PH], "landscape");
    pdf.addImage(dc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, PH);
    onProgress(`⏳ 생성 중... (${i + 1}/${validPages.length})`);
    await new Promise((r) => setTimeout(r, 10));

    const nc = await buildNoteCanvas(p, PW, PH);
    pdf.addPage([PW, PH], "landscape");
    pdf.addImage(nc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, PH);
    await new Promise((r) => setTimeout(r, 10));
  }

  const base =
    projectName.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, " ") ||
    "project";
  const filename = `${base}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
  return filename;
}
