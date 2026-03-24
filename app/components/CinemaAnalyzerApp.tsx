"use client";

import {
  computePaletteRgbKeys,
  defMeta,
  drawFalseColorCanvas,
  drawOrigAndGrid,
  drawVS,
  drawWF,
} from "@/lib/cinema-analysis";
import { IRE_BANDS, IRE_BG, IRE_FG } from "@/lib/cinema-constants";
import { exportCinemaPdf } from "@/lib/cinema-pdf";
import {
  loadPersistedProject,
  persistedPagesToRuntime,
  savePersistedProject,
  serializePage,
} from "@/lib/cinema-persistence";
import {
  markerNumberTextColor,
  NOTE_PALETTE,
} from "@/lib/cinema-note-utils";
import type {
  CinemaPage,
  DrawStroke,
  FilmMeta,
  NoteTool,
  TabId,
  TextAnnotation,
} from "@/lib/cinema-types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

function createEmptyPage(): CinemaPage {
  return {
    id: Date.now(),
    imageURL: null,
    imgEl: null,
    px: null,
    W: 0,
    H: 0,
    sourceImageURL: null,
    sourceW: 0,
    sourceH: 0,
    cropApplied: false,
    cropRatioLabel: null,
    meta: defMeta(),
    markers: [],
    strokes: [],
    textNotes: [],
    drawOverlaySize: null,
    thumb: null,
  };
}

function lineLumaStats(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  axis: "row" | "col",
  index: number,
) {
  const darkThreshold = 24;
  const sampleStep = Math.max(1, Math.floor((axis === "row" ? w : h) / 640));
  let count = 0;
  let darkCount = 0;
  let sum = 0;
  let max = 0;
  if (axis === "row") {
    const off = index * w * 4;
    for (let x = 0; x < w; x += sampleStep) {
      const i = off + x * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      if (l <= darkThreshold) darkCount++;
      if (l > max) max = l;
      count++;
    }
    return { avg: sum / Math.max(1, count), darkRatio: darkCount / Math.max(1, count), max };
  }
  for (let y = 0; y < h; y += sampleStep) {
    const i = (y * w + index) * 4;
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += l;
    if (l <= darkThreshold) darkCount++;
    if (l > max) max = l;
    count++;
  }
  return { avg: sum / Math.max(1, count), darkRatio: darkCount / Math.max(1, count), max };
}

function detectLetterboxCropRect(px: ImageData, w: number, h: number) {
  const avgThreshold = 18;
  const darkRatioThreshold = 0.97;
  const maxPixelThreshold = 42;
  const maxScanY = Math.floor(h * 0.28);
  const maxScanX = Math.floor(w * 0.2);
  const d = px.data;

  let top = 0;
  for (let y = 0; y < maxScanY; y++) {
    const s = lineLumaStats(d, w, h, "row", y);
    const isBlackLine =
      s.avg <= avgThreshold &&
      s.darkRatio >= darkRatioThreshold &&
      s.max <= maxPixelThreshold;
    if (!isBlackLine) break;
    top++;
  }

  let bottom = 0;
  for (let y = h - 1; y >= Math.max(0, h - maxScanY); y--) {
    const s = lineLumaStats(d, w, h, "row", y);
    const isBlackLine =
      s.avg <= avgThreshold &&
      s.darkRatio >= darkRatioThreshold &&
      s.max <= maxPixelThreshold;
    if (!isBlackLine) break;
    bottom++;
  }

  let left = 0;
  for (let x = 0; x < maxScanX; x++) {
    const s = lineLumaStats(d, w, h, "col", x);
    const isBlackLine =
      s.avg <= avgThreshold &&
      s.darkRatio >= darkRatioThreshold &&
      s.max <= maxPixelThreshold;
    if (!isBlackLine) break;
    left++;
  }

  let right = 0;
  for (let x = w - 1; x >= Math.max(0, w - maxScanX); x--) {
    const s = lineLumaStats(d, w, h, "col", x);
    const isBlackLine =
      s.avg <= avgThreshold &&
      s.darkRatio >= darkRatioThreshold &&
      s.max <= maxPixelThreshold;
    if (!isBlackLine) break;
    right++;
  }

  const minStripY = Math.max(2, Math.floor(h * 0.006));
  const minStripX = Math.max(2, Math.floor(w * 0.006));
  if (top < minStripY) top = 0;
  if (bottom < minStripY) bottom = 0;
  if (left < minStripX) left = 0;
  if (right < minStripX) right = 0;

  const croppedW = w - left - right;
  const croppedH = h - top - bottom;
  if (croppedW < Math.floor(w * 0.6) || croppedH < Math.floor(h * 0.6)) {
    return { x: 0, y: 0, w, h };
  }

  return { x: left, y: top, w: croppedW, h: croppedH };
}

type CinemaAnalyzerAppProps = {
  projectName: string;
  onLeaveProject: () => void;
};

export default function CinemaAnalyzerApp({
  projectName,
  onLeaveProject,
}: CinemaAnalyzerAppProps) {
  const [hydrated, setHydrated] = useState(false);
  const [pages, setPages] = useState<CinemaPage[]>(() => [createEmptyPage()]);
  const [curIdx, setCurIdx] = useState(0);
  const [curTab, setCurTab] = useState<TabId>("data");
  const [noteTool, setNoteTool] = useState<NoteTool>("marker");
  const [mkrPick, setMkrPick] = useState("#ffffff");
  const [drawPick, setDrawPick] = useState("#ffffff");
  const [textPick, setTextPick] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(2);
  const [noteStack, setNoteStack] = useState({ w: 0, h: 0 });
  const [metaForm, setMetaForm] = useState<FilmMeta>(() => defMeta());
  const [dragOver, setDragOver] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  /** 새로 찍은 텍스트 박스에 포커스 한 번만 줄 때 사용 */
  const [pendingTextFocusId, setPendingTextFocusId] = useState<string | null>(
    null,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const origRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<HTMLCanvasElement>(null);
  const wfRef = useRef<HTMLCanvasElement>(null);
  const vsRef = useRef<HTMLCanvasElement>(null);
  const noteImgRef = useRef<HTMLImageElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawDragRef = useRef<{
    stroke: DrawStroke | null;
    drawing: boolean;
  }>({ stroke: null, drawing: false });

  const p = pages[curIdx];
  const hasImg = Boolean(p?.imageURL && p?.px && p?.imgEl);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const curIdxRef = useRef(curIdx);
  curIdxRef.current = curIdx;

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    (async () => {
      const raw = loadPersistedProject(projectName);
      if (cancelled) return;
      try {
        if (raw?.pages?.length) {
          const runtime = await persistedPagesToRuntime(raw.pages);
          const list = runtime.length ? runtime : [createEmptyPage()];
          if (cancelled) return;
          setPages(list);
          setCurIdx(
            Math.min(
              Math.max(0, raw.curIdx ?? 0),
              Math.max(0, list.length - 1),
            ),
          );
        } else {
          if (cancelled) return;
          setPages([createEmptyPage()]);
          setCurIdx(0);
        }
      } catch {
        if (cancelled) return;
        setPages([createEmptyPage()]);
        setCurIdx(0);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      try {
        savePersistedProject(projectName, {
          version: 1,
          updatedAt: new Date().toISOString(),
          pages: pages.map(serializePage),
          curIdx,
        });
      } catch (e) {
        console.error(e);
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [pages, curIdx, projectName, hydrated]);

  const handleLeaveProject = () => {
    try {
      savePersistedProject(projectName, {
        version: 1,
        updatedAt: new Date().toISOString(),
        pages: pagesRef.current.map(serializePage),
        curIdx: curIdxRef.current,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
      return;
    }
    onLeaveProject();
  };

  useEffect(() => {
    if (curTab !== "meta") return;
    const page = pagesRef.current[curIdx];
    if (page) setMetaForm({ ...page.meta });
  }, [curIdx, curTab]);

  const dataDrawKey =
    curTab === "data" && p?.px && p.imgEl && p.imageURL
      ? `${curIdx}-${p.id}-${p.W}x${p.H}-${p.imageURL}`
      : null;

  useEffect(() => {
    if (!dataDrawKey) return;
    const page = pagesRef.current[curIdx];
    if (!page?.px || !page.imgEl) return;
    const oc = origRef.current;
    const gc = gridRef.current;
    const fcc = fcRef.current;
    if (!oc || !gc || !fcc) return;
    drawOrigAndGrid(oc, gc, page);
    drawFalseColorCanvas(fcc, page);
    const t0 = window.setTimeout(() => {
      if (wfRef.current) drawWF(page, wfRef.current);
    }, 0);
    const t1 = window.setTimeout(() => {
      if (vsRef.current) drawVS(page, vsRef.current);
    }, 60);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [dataDrawKey, curIdx]);

  useEffect(() => {
    let rtimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(rtimer);
      rtimer = setTimeout(() => {
        const page = pagesRef.current[curIdx];
        if (page?.px && wfRef.current && vsRef.current) {
          drawWF(page, wfRef.current);
          drawVS(page, vsRef.current);
        }
      }, 300);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(rtimer);
    };
  }, [curIdx]);

  const paletteKeys =
    p?.px && p.W && p.H ? computePaletteRgbKeys(p.px, p.W, p.H) : [];

  const handleNewPage = () => {
    setPages((prev) => {
      const next = [...prev, { ...createEmptyPage(), id: Date.now() }];
      queueMicrotask(() => setCurIdx(next.length - 1));
      return next;
    });
  };

  const selectPage = (i: number) => {
    setCurIdx(i);
  };

  const deletePage = (i: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPages((prev) => {
      const next = prev.filter((_, j) => j !== i);
      if (next.length === 0) {
        queueMicrotask(() => {
          setCurIdx(0);
          setCurTab("data");
        });
        return [createEmptyPage()];
      }
      queueMicrotask(() => {
        setCurIdx((ci) => {
          if (ci >= next.length) return next.length - 1;
          if (i < ci) return ci - 1;
          return ci;
        });
      });
      return next;
    });
  };

  const readFileAtIndex = (file: File, idx: number) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sourceW = img.naturalWidth;
      const sourceH = img.naturalHeight;
      const tmp = document.createElement("canvas");
      tmp.width = sourceW;
      tmp.height = sourceH;
      tmp.getContext("2d")!.drawImage(img, 0, 0);
      const pxAll = tmp.getContext("2d")!.getImageData(0, 0, sourceW, sourceH);
      const cropRect = detectLetterboxCropRect(pxAll, sourceW, sourceH);
      const cropApplied =
        cropRect.x > 0 ||
        cropRect.y > 0 ||
        cropRect.w < sourceW ||
        cropRect.h < sourceH;
      let workCanvas = tmp;
      let W = sourceW;
      let H = sourceH;
      if (cropApplied) {
        const cropped = document.createElement("canvas");
        cropped.width = cropRect.w;
        cropped.height = cropRect.h;
        cropped
          .getContext("2d")!
          .drawImage(
            tmp,
            cropRect.x,
            cropRect.y,
            cropRect.w,
            cropRect.h,
            0,
            0,
            cropRect.w,
            cropRect.h,
          );
        workCanvas = cropped;
        W = cropRect.w;
        H = cropRect.h;
      }
      const px = workCanvas.getContext("2d")!.getImageData(0, 0, W, H);
      const analysisDataUrl = workCanvas.toDataURL("image/jpeg", 0.92);
      const analysisImg = new Image();
      analysisImg.onload = () => {
        const tc2 = document.createElement("canvas");
        tc2.width = 280;
        tc2.height = 158;
        tc2.getContext("2d")!.drawImage(analysisImg, 0, 0, 280, 158);
        const thumb = tc2.toDataURL("image/jpeg", 0.75);
        setPages((prev) => {
          if (!prev[idx]) return prev;
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            imageURL: analysisDataUrl,
            imgEl: analysisImg,
            W,
            H,
            sourceImageURL: url,
            sourceW,
            sourceH,
            cropApplied,
            cropRatioLabel: `${(W / H).toFixed(2)}:1`,
            px,
            thumb,
            markers: [],
            strokes: [],
            textNotes: [],
            drawOverlaySize: null,
          };
          return copy;
        });
        if (cropApplied) {
          setPdfToast(`레터박스 감지: ${(W / H).toFixed(2)}:1로 크롭되었습니다`);
          window.setTimeout(() => setPdfToast(null), 2600);
        }
        setCurTab((t) => (t === "data" || t === "note" ? t : "data"));
      };
      analysisImg.src = analysisDataUrl;
    };
    img.src = url;
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (curIdx < 0 || pages.length === 0) {
      setPages([{ ...createEmptyPage(), id: Date.now() }]);
      setCurIdx(0);
      queueMicrotask(() => readFileAtIndex(file, 0));
    } else {
      readFileAtIndex(file, curIdx);
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (curIdx < 0 || pages.length === 0) {
      setPages([{ ...createEmptyPage(), id: Date.now() }]);
      setCurIdx(0);
      queueMicrotask(() => readFileAtIndex(file, 0));
    } else {
      readFileAtIndex(file, curIdx);
    }
  };

  const switchTab = (tab: TabId) => {
    setCurTab(tab);
  };

  const saveMeta = () => {
    if (curIdx < 0) return;
    setPages((prev) => {
      const next = [...prev];
      if (!next[curIdx]) return prev;
      next[curIdx] = { ...next[curIdx], meta: { ...metaForm } };
      return next;
    });
    if (pages[curIdx]?.imageURL) setCurTab("data");
  };

  const updateMarkerText = (mi: number, text: string) => {
    setPages((prev) => {
      const next = [...prev];
      const pg = next[curIdx];
      if (!pg) return prev;
      const markers = pg.markers.map((m, i) =>
        i === mi ? { ...m, text } : m,
      );
      next[curIdx] = { ...pg, markers };
      return next;
    });
  };

  const addMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (noteTool !== "marker" || curIdx < 0) return;
    const img = noteImgRef.current;
    if (!img || !pages[curIdx]?.imageURL) return;
    const rect = img.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }
    const pick = mkrPick;
    setPages((prev) => {
      const next = [...prev];
      const page = next[curIdx];
      if (!page?.imageURL) return prev;
      const n = page.markers.length + 1;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      next[curIdx] = {
        ...page,
        markers: [...page.markers, { n, x, y, text: "", color: pick }],
      };
      return next;
    });
  };

  const consumePendingTextFocus = useCallback(() => {
    setPendingTextFocusId(null);
  }, []);

  const addTextNote = (e: React.MouseEvent<HTMLDivElement>) => {
    if (noteTool !== "text" || curIdx < 0) return;
    if ((e.target as HTMLElement).closest("[data-text-annotation]")) return;
    const img = noteImgRef.current;
    if (!img || !pages[curIdx]?.imageURL) return;
    const rect = img.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const color = textPick;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `t-${Date.now()}`;
    const ann: TextAnnotation = { id, x, y, color, content: "" };
    setPages((prev) => {
      const next = [...prev];
      const page = next[curIdx];
      if (!page?.imageURL) return prev;
      next[curIdx] = {
        ...page,
        textNotes: [...page.textNotes, ann],
      };
      return next;
    });
    setPendingTextFocusId(id);
  };

  const updateTextNoteContent = (id: string, content: string) => {
    setPages((prev) => {
      const next = [...prev];
      const pg = next[curIdx];
      if (!pg) return prev;
      next[curIdx] = {
        ...pg,
        textNotes: pg.textNotes.map((t) =>
          t.id === id ? { ...t, content } : t,
        ),
      };
      return next;
    });
  };

  const deleteTextNote = (id: string) => {
    setPages((prev) => {
      const next = [...prev];
      const pg = next[curIdx];
      if (!pg) return prev;
      next[curIdx] = {
        ...pg,
        textNotes: pg.textNotes.filter((t) => t.id !== id),
      };
      return next;
    });
  };

  const updateTextNotePosition = (id: string, x: number, y: number) => {
    const cx = Math.min(100, Math.max(0, x));
    const cy = Math.min(100, Math.max(0, y));
    setPages((prev) => {
      const next = [...prev];
      const pg = next[curIdx];
      if (!pg) return prev;
      next[curIdx] = {
        ...pg,
        textNotes: pg.textNotes.map((t) =>
          t.id === id ? { ...t, x: cx, y: cy } : t,
        ),
      };
      return next;
    });
  };

  const getImageRect = useCallback(
    () => noteImgRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  const undoStroke = () => {
    if (curIdx < 0) return;
    setPages((prev) => {
      const next = [...prev];
      const pg = next[curIdx];
      if (!pg?.strokes.length) return prev;
      next[curIdx] = {
        ...pg,
        strokes: pg.strokes.slice(0, -1),
      };
      return next;
    });
  };

  const clearNoteAll = () => {
    if (curIdx < 0) return;
    setPages((prev) => {
      const next = [...prev];
      if (!next[curIdx]) return prev;
      next[curIdx] = {
        ...next[curIdx],
        markers: [],
        strokes: [],
        textNotes: [],
      };
      return next;
    });
  };

  const measureNoteStack = useCallback(() => {
    const img = noteImgRef.current;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (w > 0 && h > 0) setNoteStack({ w, h });
  }, []);

  useEffect(() => {
    if (curTab !== "note" || !p?.imageURL) return;
    const img = noteImgRef.current;
    if (!img) return;
    measureNoteStack();
    const ro = new ResizeObserver(() => measureNoteStack());
    ro.observe(img);
    return () => ro.disconnect();
  }, [curTab, p?.imageURL, p?.id, measureNoteStack]);

  useEffect(() => {
    if (curTab !== "note" || !p?.imageURL || noteStack.w <= 0) return;
    setPages((prev) => {
      const pg = prev[curIdx];
      if (!pg) return prev;
      if (
        pg.drawOverlaySize?.w === noteStack.w &&
        pg.drawOverlaySize?.h === noteStack.h
      ) {
        return prev;
      }
      const next = [...prev];
      next[curIdx] = {
        ...pg,
        drawOverlaySize: { w: noteStack.w, h: noteStack.h },
      };
      return next;
    });
  }, [noteStack, curTab, curIdx, p?.imageURL]);

  const paintStrokesOnCanvas = useCallback(() => {
    const c = drawCanvasRef.current;
    if (!c || noteStack.w <= 0) return;
    c.width = noteStack.w;
    c.height = noteStack.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const page = pagesRef.current[curIdx];
    if (!page?.strokes?.length) return;
    page.strokes.forEach((s) => {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
    });
  }, [noteStack.w, noteStack.h, curIdx]);

  useEffect(() => {
    if (curTab !== "note") return;
    paintStrokesOnCanvas();
  }, [curTab, p?.strokes, noteStack.w, noteStack.h, paintStrokesOnCanvas]);

  useEffect(() => {
    const el = drawCanvasRef.current;
    if (
      !el ||
      noteTool !== "draw" ||
      curTab !== "note" ||
      noteStack.w <= 0
    ) {
      return;
    }

    const activePointerId = { current: null as number | null };

    const pt = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      activePointerId.current = e.pointerId;
      drawDragRef.current.drawing = true;
      drawDragRef.current.stroke = {
        color: drawPick,
        width: brushSize,
        points: [pt(e)],
      };
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const s = drawDragRef.current.stroke;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(s.points[0].x, s.points[0].y);
    };

    const onMove = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      if (!drawDragRef.current.drawing || !drawDragRef.current.stroke) return;
      const s = drawDragRef.current.stroke;
      const p0 = pt(e);
      s.points.push(p0);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const prev = s.points[s.points.length - 2];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p0.x, p0.y);
      ctx.stroke();
    };

    const endDraw = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!drawDragRef.current.drawing || !drawDragRef.current.stroke) return;
      const s = drawDragRef.current.stroke;
      drawDragRef.current.drawing = false;
      drawDragRef.current.stroke = null;
      const idx = curIdxRef.current;
      if (s.points.length > 1 && idx >= 0) {
        setPages((prev) => {
          const next = [...prev];
          const pg = next[idx];
          if (!pg) return prev;
          next[idx] = { ...pg, strokes: [...pg.strokes, s] };
          return next;
        });
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", endDraw);
    el.addEventListener("pointercancel", endDraw);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", endDraw);
      el.removeEventListener("pointercancel", endDraw);
    };
  }, [noteTool, curTab, drawPick, brushSize, noteStack.w, noteStack.h]);

  const runExport = async () => {
    const validPages = pages.filter((pg) => pg.imageURL);
    if (!validPages.length) {
      window.alert(
        "보낼 이미지가 없습니다.\n이미지를 먼저 import 해주세요.",
      );
      return;
    }
    setExportBusy(true);
    setPdfToast("⏳ PDF 생성 중...");
    await new Promise((r) => setTimeout(r, 30));
    try {
      await exportCinemaPdf(validPages, projectName, (label) =>
        setPdfToast(label),
      );
      setPdfToast("✓ PDF 저장 완료");
      window.setTimeout(() => setPdfToast(null), 2000);
    } finally {
      setExportBusy(false);
    }
  };

  const showWelcome =
    (curTab === "data" || curTab === "note") && !hasImg;

  const m = p?.meta ?? defMeta();

  if (!hydrated) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center bg-black text-[#444]">
        <p className="text-[9px] tracking-[3px]">LOADING PROJECT…</p>
        <p
          className="mt-2 max-w-[min(90%,320px)] truncate text-[8px] text-[#888]"
          title={projectName}
        >
          {projectName}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-black text-[#bbb] ${dragOver ? "[&_.dropbox]:border-[#3a3a3a]" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileInput}
      />

      <header className="flex h-[38px] shrink-0 items-center border-b border-[#1c1c1c] bg-[#030303]">
        <div className="flex h-full items-center border-r border-[#1c1c1c] px-[14px] text-[11px] tracking-[4px] text-[#888]">
          FRAME METER
        </div>
        <button
          type="button"
          onClick={handleLeaveProject}
          className="h-full shrink-0 border-r border-[#1c1c1c] px-[12px] text-[9px] tracking-[1px] text-[#888] hover:bg-[#0d0d0d] hover:text-[#fff]"
        >
          ← PROJECTS
        </button>
        <div
          className="hidden h-full max-w-[min(28vw,200px)] shrink-0 items-center overflow-hidden text-ellipsis border-r border-[#1c1c1c] px-3 text-[8px] text-[#888] sm:flex"
          title={projectName}
        >
          {projectName}
        </div>
        <button
          type="button"
          onClick={handleNewPage}
          className="h-full border-r border-[#1c1c1c] bg-[#0d0d0d] px-[14px] text-[9px] tracking-[2px] text-[#888] hover:bg-[#1a1a1a] hover:text-white"
        >
          ⊕ NEW PAGE
        </button>
        {(["data", "note", "meta"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`h-full border-r border-[#1c1c1c] px-[14px] text-[9px] tracking-[2px] hover:bg-[#0d0d0d] hover:text-[#ccc] ${
              curTab === t
                ? "border-b-2 border-b-white bg-[#111] text-white"
                : "bg-transparent text-[#666]"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          disabled={exportBusy}
          onClick={runExport}
          className="h-full border-l border-[#1c1c1c] px-[14px] text-[9px] tracking-[2px] text-[#888] transition-colors hover:text-[#fff] disabled:pointer-events-none disabled:text-[#666]"
        >
          {exportBusy ? "GENERATING..." : "PDF EXPORT ↗"}
        </button>
      </header>

      <div className="flex h-[26px] shrink-0 items-center gap-[10px] overflow-hidden border-b border-[#111] bg-[#010101] px-2 text-[9px]">
        <div className="shrink-0 whitespace-nowrap text-[#ccc]">
          {m.title ? `< ${m.title} >` : "< FILM TITLE >"}
        </div>
        {[
          ["Dir", m.dir],
          ["DP", m.dp],
          ["Loc", m.loc],
          ["D/N", m.dn],
          ["Size", m.size],
          ["Type", m.type],
          ["Level", m.level],
          ["Move", m.move],
          ["Color", m.color],
          ["Lens", m.lens],
          ["Camera", m.camera],
          ["AR", p?.cropRatioLabel ?? (p?.W && p?.H ? `${(p.W / p.H).toFixed(2)}:1` : "—")],
          [
            "Crop",
            p?.cropApplied
              ? `ON (${p.sourceW}x${p.sourceH}→${p.W}x${p.H})`
              : "OFF",
          ],
        ].map(([k, v]) => (
          <div key={String(k)} className="shrink-0 whitespace-nowrap">
            <span className="text-[#888]">{k} : </span>
            <span className="text-[#ccc]">{v || "—"}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[158px] shrink-0 flex-col overflow-hidden border-r border-[#181818] bg-[#050505]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#0f0f0f] px-2 py-[7px] pb-[5px] text-[7px] tracking-[2px] text-[#888]">
            <span>DOCUMENT</span>
            <span>
              {pages.length} PAGE{pages.length !== 1 ? "S" : ""}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-[6px] pb-[30px] pt-[5px]">
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                role="button"
                tabIndex={0}
                onClick={() => selectPage(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectPage(i);
                  }
                }}
                className={`group relative mb-[7px] w-full cursor-pointer border border-[#181818] bg-[#080808] text-left transition-[border-color] hover:border-[#2e2e2e] ${
                  i === curIdx ? "border-[#777]" : ""
                }`}
              >
                <span className="absolute left-1 top-[3px] z-[2] text-[7px] leading-none text-[#888]">
                  {i + 1}
                </span>
                <SlideThumb thumb={pg.thumb} />
                <div className="overflow-hidden border-t border-[#101010] px-[5px] py-[3px] text-[7px] tracking-[1px] text-[#888] text-ellipsis whitespace-nowrap">
                  {pg.meta.title || "UNTITLED"}
                </div>
                <button
                  type="button"
                  aria-label="페이지 삭제"
                  onClick={(ev) => deletePage(i, ev)}
                  className="absolute right-[3px] top-[3px] z-[3] hidden h-[13px] w-[13px] items-center justify-center border-none bg-[rgba(160,0,0,0.7)] p-0 text-[8px] leading-none text-white hover:bg-[rgba(220,0,0,1)] group-hover:flex"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleNewPage}
            className="flex shrink-0 cursor-pointer items-center justify-center border-t border-[#0f0f0f] py-[9px] text-[8px] tracking-[2px] text-[#888] transition-colors hover:bg-[#0d0d0d] hover:text-[#ccc]"
          >
            ⊕ &nbsp;ADD PAGE
          </button>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {showWelcome ? (
            <button
              type="button"
              className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-[9px] tracking-[4px] text-[#888]">
                CINEMA IMAGE ANALYSIS TOOL
              </div>
              <div className="dropbox border border-dashed border-[#1a1a1a] px-[65px] py-[38px] text-center transition-[border-color] duration-200 group-hover:border-[#2e2e2e]">
                <div className="mb-2 text-[10px] tracking-[3px] text-[#ccc]">
                  CLICK TO IMPORT IMAGE
                </div>
                <div className="text-[9px] text-[#888]">
                  JPG · PNG · TIFF · WEBP
                </div>
              </div>
              <div className="text-[8px] tracking-[2px] text-[#888]">
                OR DRAG & DROP
              </div>
            </button>
          ) : null}

          {!showWelcome && curTab === "data" && p ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-[1_1_50%] overflow-hidden border-b border-[#0f0f0f]">
                <div className="flex min-w-0 flex-1 flex-row items-stretch border-r border-[#0f0f0f]">
                  <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
                    <RasterPreviewFrame W={p.W} H={p.H}>
                      <canvas
                        ref={origRef}
                        className="block h-full w-full"
                        style={{ display: "block" }}
                      />
                    </RasterPreviewFrame>
                  </div>
                  <div className="flex w-[15px] shrink-0 flex-col border-l border-[#0f0f0f]">
                    {paletteKeys.map((k) => (
                      <div
                        key={k}
                        className="min-h-0 flex-1"
                        style={{ background: `rgb(${k})` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
                  <RasterPreviewFrame W={p.W} H={p.H}>
                    <canvas
                      ref={gridRef}
                      className="block h-full w-full"
                      style={{ display: "block" }}
                    />
                  </RasterPreviewFrame>
                </div>
              </div>

              <div className="flex min-h-0 flex-[1_1_50%] overflow-hidden">
                <div className="scope-box flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[#0f0f0f]">
                  <div className="shrink-0 bg-[#020202] px-[5px] py-[3px] text-[7px] tracking-[2px] text-[#888]">
                    FALSE COLOR
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-[2px] border-b border-[#0f0f0f] bg-[#020202] px-[6px] py-[3px]">
                    {IRE_BANDS.map((band, i) => (
                      <div
                        key={`${band.min}-${band.max}`}
                        className="flex min-w-[42px] flex-col items-center justify-center border-none px-[4px] py-[2px] text-[8px] leading-tight"
                        style={{
                          background: IRE_BG[i],
                          color: IRE_FG[i],
                        }}
                      >
                        <span className="text-[8px]">{band.label}</span>
                        <span className="text-[7px] opacity-90">{band.stop}</span>
                      </div>
                    ))}
                  </div>
                  <div className="relative min-h-0 flex-1">
                    <RasterScopeFrame W={p.W} H={p.H}>
                      <canvas
                        ref={fcRef}
                        className="block h-full w-full"
                        style={{ display: "block" }}
                      />
                    </RasterScopeFrame>
                  </div>
                </div>
                <div className="scope-box flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[#0f0f0f]">
                  <div className="shrink-0 bg-[#020202] px-[5px] py-[3px] text-[7px] tracking-[2px] text-[#888]">
                    WAVEFORM
                  </div>
                  <canvas ref={wfRef} className="block w-full flex-1" />
                </div>
                <div className="scope-box flex min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="shrink-0 bg-[#020202] px-[5px] py-[3px] text-[7px] tracking-[2px] text-[#888]">
                    VECTORSCOPE
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-[4px]">
                    <div className="aspect-square h-full w-auto max-w-full">
                      <canvas ref={vsRef} className="block h-full w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!showWelcome && curTab === "note" && p?.imageURL ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="relative flex max-h-[57vh] shrink-0 justify-center overflow-hidden border-b border-[#0f0f0f]">
                <div
                  className={`relative max-h-[57vh] ${
                    noteTool === "marker" || noteTool === "text"
                      ? "cursor-crosshair"
                      : "cursor-default"
                  }`}
                  style={
                    noteStack.w > 0
                      ? { width: noteStack.w, height: noteStack.h }
                      : undefined
                  }
                  onClick={
                    noteTool === "marker"
                      ? addMarker
                      : noteTool === "text"
                        ? addTextNote
                        : undefined
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs for user stills */}
                  <img
                    ref={noteImgRef}
                    src={p.imageURL}
                    alt=""
                    onLoad={measureNoteStack}
                    className="pointer-events-none block max-h-[57vh] max-w-full object-contain"
                  />
                  <canvas
                    ref={drawCanvasRef}
                    className="absolute left-0 top-0 z-[1] block touch-none"
                    style={{
                      width: noteStack.w > 0 ? noteStack.w : "100%",
                      height: noteStack.h > 0 ? noteStack.h : "100%",
                      touchAction: "none",
                      pointerEvents:
                        noteTool === "draw" && noteStack.w > 0
                          ? "auto"
                          : "none",
                      cursor:
                        noteTool === "draw" && noteStack.w > 0
                          ? "crosshair"
                          : "default",
                    }}
                    width={Math.max(1, noteStack.w)}
                    height={Math.max(1, noteStack.h)}
                  />
                  <div className="pointer-events-none absolute inset-0">
                    {p.markers.map((mkr) => (
                      <div
                        key={mkr.n}
                        className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black/30 text-[9px] font-bold shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                        style={{
                          left: `${mkr.x}%`,
                          top: `${mkr.y}%`,
                          background: mkr.color || "#ffffff",
                          color: markerNumberTextColor(
                            mkr.color || "#ffffff",
                          ),
                        }}
                      >
                        {mkr.n}
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-0 z-[2]">
                    {p.textNotes.map((tn) => (
                      <InlineTextAnnotation
                        key={tn.id}
                        annotation={tn}
                        editable={noteTool === "text"}
                        autoFocus={pendingTextFocusId === tn.id}
                        getImageRect={getImageRect}
                        onUpdate={updateTextNoteContent}
                        onDelete={deleteTextNote}
                        onPositionChange={updateTextNotePosition}
                        onAutoFocusConsumed={consumePendingTextFocus}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-[6px] border-b border-[#0f0f0f] bg-[#020202] px-2 py-[5px]">
                <button
                  type="button"
                  onClick={() => setNoteTool("marker")}
                  className={`whitespace-nowrap border px-[10px] py-0.5 text-[8px] tracking-[1px] ${
                    noteTool === "marker"
                      ? "border-[#404040] bg-[#1a1a1a] text-white"
                      : "border-[#181818] bg-[#0d0d0d] text-[#666] hover:border-[#444] hover:text-[#ccc]"
                  }`}
                >
                  ● MARKER
                </button>
                {NOTE_PALETTE.map((c) => (
                  <button
                    key={`m-${c.hex}`}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setNoteTool("marker");
                      setMkrPick(c.hex);
                    }}
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-[border-color] hover:border-[#aaa] ${
                      noteTool === "marker" && mkrPick === c.hex
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
                <div className="h-4 w-px shrink-0 bg-[#1e1e1e]" aria-hidden />
                <button
                  type="button"
                  onClick={() => setNoteTool("draw")}
                  className={`whitespace-nowrap border px-[10px] py-0.5 text-[8px] tracking-[1px] ${
                    noteTool === "draw"
                      ? "border-[#404040] bg-[#1a1a1a] text-white"
                      : "border-[#181818] bg-[#0d0d0d] text-[#666] hover:border-[#444] hover:text-[#ccc]"
                  }`}
                >
                  ✏ DRAW
                </button>
                {NOTE_PALETTE.map((c) => (
                  <button
                    key={`d-${c.hex}`}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setNoteTool("draw");
                      setDrawPick(c.hex);
                    }}
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-[border-color] hover:border-[#aaa] ${
                      noteTool === "draw" && drawPick === c.hex
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={brushSize}
                  onChange={(e) =>
                    setBrushSize(Number.parseInt(e.target.value, 10))
                  }
                  title="Brush size"
                  className="w-[60px] cursor-pointer accent-[#555]"
                />
                <div className="h-4 w-px shrink-0 bg-[#1e1e1e]" aria-hidden />
                <button
                  type="button"
                  onClick={() => setNoteTool("text")}
                  className={`whitespace-nowrap border px-[10px] py-0.5 text-[8px] tracking-[1px] ${
                    noteTool === "text"
                      ? "border-[#404040] bg-[#1a1a1a] text-white"
                      : "border-[#181818] bg-[#0d0d0d] text-[#666] hover:border-[#444] hover:text-[#ccc]"
                  }`}
                >
                  T TEXT
                </button>
                {NOTE_PALETTE.map((c) => (
                  <button
                    key={`t-${c.hex}`}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setNoteTool("text");
                      setTextPick(c.hex);
                    }}
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-[border-color] hover:border-[#aaa] ${
                      noteTool === "text" && textPick === c.hex
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
                <div className="h-4 w-px shrink-0 bg-[#1e1e1e]" aria-hidden />
                <button
                  type="button"
                  onClick={undoStroke}
                  className="whitespace-nowrap border border-[#181818] bg-[#0d0d0d] px-[10px] py-0.5 text-[8px] tracking-[1px] text-[#666] hover:border-[#444] hover:text-[#ccc]"
                >
                  ↩ UNDO
                </button>
                <button
                  type="button"
                  onClick={clearNoteAll}
                  className="whitespace-nowrap border border-[#181818] bg-[#0d0d0d] px-[10px] py-0.5 text-[8px] tracking-[1px] text-[#666] hover:border-[#444] hover:text-[#ccc]"
                >
                  ✕ CLEAR ALL
                </button>
                <span className="min-w-0 flex-1 text-[8px] tracking-[1px] text-[#888]">
                  {noteTool === "draw"
                    ? "DRAW MODE — DRAG TO DRAW"
                    : noteTool === "text"
                      ? "TEXT — 빈 곳 클릭: 추가 · 박스 클릭: 편집"
                      : "MARKER MODE — CLICK IMAGE TO PLACE"}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-[14px] py-[10px]">
                <div className="mb-2 text-[7px] tracking-[2px] text-[#888]">
                  NOTE
                </div>
                {p.markers.map((mkr, mi) => (
                  <div
                    key={mkr.n}
                    className="mb-[7px] flex items-start gap-[6px]"
                  >
                    <span
                      className="mt-[5px] h-2 w-2 shrink-0 rounded-full border border-[#333]"
                      style={{
                        background: mkr.color || "#ffffff",
                      }}
                      aria-hidden
                    />
                    <span className="min-w-[15px] pt-[3px] text-[9px] text-[#888]">
                      {mkr.n})
                    </span>
                    <input
                      className="flex-1 border-0 border-b border-[#141414] bg-transparent py-0.5 text-[9px] leading-[1.7] text-[#ccc] outline-none placeholder:text-[#888] focus:border-[#666] focus:text-[#fff]"
                      placeholder={`마커 ${mkr.n} 노트...`}
                      value={mkr.text}
                      onChange={(e) => updateMarkerText(mi, e.target.value)}
                    />
                  </div>
                ))}
                {!p.markers.length ? (
                  <div className="text-[9px] text-[#888]">
                    마커를 추가하면 노트를 작성할 수 있습니다.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {curTab === "meta" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-[14px] text-[8px] tracking-[3px] text-[#888]">
                METADATA EDIT
              </div>
              <div className="grid max-w-[580px] grid-cols-2 gap-[11px]">
                <MetaField
                  className="col-span-2"
                  label="FILM TITLE"
                  value={metaForm.title}
                  onChange={(v) =>
                    setMetaForm((f) => ({ ...f, title: v }))
                  }
                  placeholder='ex) Nightcrawler"'
                />
                <MetaField
                  label="DIRECTOR"
                  value={metaForm.dir}
                  onChange={(v) => setMetaForm((f) => ({ ...f, dir: v }))}
                  placeholder="Dan Gilroy"
                />
                <MetaField
                  label="DP"
                  value={metaForm.dp}
                  onChange={(v) => setMetaForm((f) => ({ ...f, dp: v }))}
                  placeholder="Robert Elswit"
                />
                <MetaField
                  label="LOCATION"
                  value={metaForm.loc}
                  onChange={(v) => setMetaForm((f) => ({ ...f, loc: v }))}
                  placeholder="Car, Road"
                />
                <MetaField
                  label="D/N"
                  value={metaForm.dn}
                  onChange={(v) => setMetaForm((f) => ({ ...f, dn: v }))}
                  placeholder="D / N"
                />
                <MetaField
                  label="SIZE"
                  value={metaForm.size}
                  onChange={(v) => setMetaForm((f) => ({ ...f, size: v }))}
                  placeholder="B.S / M.S / W.S"
                />
                <MetaField
                  label="TYPE"
                  value={metaForm.type}
                  onChange={(v) => setMetaForm((f) => ({ ...f, type: v }))}
                  placeholder="Front / Profile"
                />
                <MetaField
                  label="LEVEL"
                  value={metaForm.level}
                  onChange={(v) => setMetaForm((f) => ({ ...f, level: v }))}
                  placeholder="Eye / Low / High"
                />
                <MetaField
                  label="MOVE"
                  value={metaForm.move}
                  onChange={(v) => setMetaForm((f) => ({ ...f, move: v }))}
                  placeholder="Stick / Pan / Tilt"
                />
                <MetaField
                  label="COLOR TEMP"
                  value={metaForm.color}
                  onChange={(v) => setMetaForm((f) => ({ ...f, color: v }))}
                  placeholder="4800K-5600K"
                />
                <MetaField
                  label="LENS"
                  value={metaForm.lens}
                  onChange={(v) => setMetaForm((f) => ({ ...f, lens: v }))}
                  placeholder="50mm"
                />
                <MetaField
                  label="CAMERA"
                  value={metaForm.camera}
                  onChange={(v) => setMetaForm((f) => ({ ...f, camera: v }))}
                  placeholder="Alexa XT Plus"
                />
                <MetaField
                  label="LENSES"
                  value={metaForm.lenses}
                  onChange={(v) =>
                    setMetaForm((f) => ({ ...f, lenses: v }))
                  }
                  placeholder="Panavision Super Speed"
                />
              </div>
              <button
                type="button"
                onClick={saveMeta}
                className="mt-[14px] border border-[#1e1e1e] bg-[#111] px-[18px] py-[5px] text-[8px] tracking-[2px] text-[#ccc] hover:border-[#666] hover:text-white"
              >
                APPLY →
              </button>
            </div>
          ) : null}
        </main>
      </div>

      {pdfToast ? (
        <div className="fixed bottom-5 right-5 z-[9999] border border-[#2a2a2a] bg-[#111] px-[18px] py-[10px] text-[9px] tracking-[2px] text-[#aaa]">
          {pdfToast}
        </div>
      ) : null}
    </div>
  );
}

/** 이미지 위 직접 편집 (TEXT 모드에서만 contentEditable) */
function InlineTextAnnotation({
  annotation: tn,
  editable,
  autoFocus,
  getImageRect,
  onUpdate,
  onDelete,
  onPositionChange,
  onAutoFocusConsumed,
}: {
  annotation: TextAnnotation;
  editable: boolean;
  autoFocus: boolean;
  getImageRect: () => DOMRect | null;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onAutoFocusConsumed: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const textDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // id가 바뀔 때만 props → DOM 동기화 (입력 중에는 onInput이 단일 출처)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.textContent = tn.content;
  }, [tn.id]); // eslint-disable-line react-hooks/exhaustive-deps -- tn.content 제외

  useLayoutEffect(() => {
    if (!autoFocus || !editable || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    onAutoFocusConsumed();
  }, [autoFocus, editable, tn.id, onAutoFocusConsumed]);

  const boxClass =
    "min-h-[1.15em] min-w-[4ch] max-w-[min(85vw,280px)] whitespace-pre-wrap break-words rounded-sm px-0.5 text-left text-[10px] font-bold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]";

  const handleBlur = () => {
    const el = ref.current;
    if (!el) return;
    const raw = el.innerText.replace(/\u200b/g, "").trim();
    if (raw === "") {
      onDelete(tn.id);
    } else {
      onUpdate(tn.id, el.innerText);
    }
  };

  const onTextDragPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = getImageRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    textDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: tn.x,
      origY: tn.y,
    };
  };

  const onTextDragPointerMove = (e: React.PointerEvent) => {
    const d = textDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const rect = getImageRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const dxPct = ((e.clientX - d.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - d.startClientY) / rect.height) * 100;
    onPositionChange(
      tn.id,
      Math.min(100, Math.max(0, d.origX + dxPct)),
      Math.min(100, Math.max(0, d.origY + dyPct)),
    );
  };

  const onTextDragPointerUp = (e: React.PointerEvent) => {
    const d = textDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    textDragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${editable ? "pointer-events-auto group" : "pointer-events-none"}`}
      style={{ left: `${tn.x}%`, top: `${tn.y}%` }}
      data-text-annotation
      onMouseDown={editable ? (e) => e.stopPropagation() : undefined}
    >
      {editable ? (
        <button
          type="button"
          title="위치 이동"
          aria-label="텍스트 위치 이동"
          className="absolute -left-5 top-1/2 z-[6] flex h-7 w-4 -translate-y-1/2 cursor-grab items-center justify-center rounded-sm border border-[#2a2a2a] bg-[#111] text-[10px] leading-none text-[#666] active:cursor-grabbing hover:border-[#555] hover:text-[#ccc]"
          onPointerDown={onTextDragPointerDown}
          onPointerMove={onTextDragPointerMove}
          onPointerUp={onTextDragPointerUp}
          onPointerCancel={onTextDragPointerUp}
        >
          ⋮
        </button>
      ) : null}
      {editable ? (
        <button
          type="button"
          className="absolute -right-1 -top-1 z-[5] flex h-4 w-4 items-center justify-center rounded-sm border border-[#2a2a2a] bg-[#111] text-[10px] leading-none text-[#888] opacity-0 transition-opacity hover:border-[#444] hover:bg-[#1a1a1a] hover:text-white group-hover:opacity-100"
          aria-label="텍스트 삭제"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tn.id);
          }}
        >
          ×
        </button>
      ) : null}
      <div
        ref={ref}
        contentEditable={editable}
        suppressContentEditableWarning
        className={`${boxClass} outline-none ${editable ? "cursor-text focus:ring-1 focus:ring-white/50" : "pointer-events-none cursor-default"}`}
        style={{ color: tn.color }}
        onInput={
          editable
            ? (e) => onUpdate(tn.id, e.currentTarget.innerText)
            : undefined
        }
        onBlur={editable ? handleBlur : undefined}
      />
    </div>
  );
}

/** DATA 상단: 원본·그리드 — 동일 종횡비(W:H), 최대 높이 35vh, 좌우 여백 허용 */
function RasterPreviewFrame({
  W,
  H,
  children,
}: {
  W: number;
  H: number;
  children: React.ReactNode;
}) {
  if (!W || !H) return <>{children}</>;
  return (
    <div
      className="mx-auto max-w-full shrink-0"
      style={{
        aspectRatio: `${W} / ${H}`,
        maxHeight: "35vh",
        width: `min(100%, calc(35vh * ${W} / ${H}))`,
      }}
    >
      <div className="h-full w-full">{children}</div>
    </div>
  );
}

/** 스코프 행 FALSE COLOR — 가용 영역 안에서 원본과 동일 종횡비 유지 */
function RasterScopeFrame({
  W,
  H,
  children,
}: {
  W: number;
  H: number;
  children: React.ReactNode;
}) {
  if (!W || !H) return <>{children}</>;
  return (
    <div className="absolute inset-0 flex min-h-0 items-center justify-center overflow-hidden">
      <div
        className="min-h-0 min-w-0"
        style={{
          aspectRatio: `${W} / ${H}`,
          height: "100%",
          maxWidth: "100%",
          width: "auto",
        }}
      >
        <div className="h-full w-full">{children}</div>
      </div>
    </div>
  );
}

function SlideThumb({ thumb }: { thumb: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = 280;
    c.height = 158;
    if (thumb) {
      const im = new Image();
      im.onload = () => ctx.drawImage(im, 0, 0, 280, 158);
      im.src = thumb;
    } else {
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, 280, 158);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "9px Space Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("NO IMAGE", 140, 79);
    }
  }, [thumb]);
  return (
    <canvas
      ref={ref}
      className="simg block aspect-video w-full bg-[#060606]"
      width={280}
      height={158}
    />
  );
}

function MetaField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-[3px] block text-[7px] tracking-[1px] text-[#888]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[#131313] bg-[#060606] px-[6px] py-[5px] text-[9px] text-[#ccc] outline-none placeholder:text-[#888] focus:border-[#666] focus:text-[#fff]"
      />
    </label>
  );
}
