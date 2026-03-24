import { defMeta } from "@/lib/cinema-analysis";
import type {
  CinemaPage,
  DrawStroke,
  FilmMeta,
  Marker,
  TextAnnotation,
} from "@/lib/cinema-types";

const STORAGE_KEY = "cinema-analyzer-projects-v1";

export type PersistedPage = {
  id: number;
  imageDataUrl: string | null;
  W: number;
  H: number;
  meta: FilmMeta;
  markers: Marker[];
  strokes: DrawStroke[];
  textNotes: TextAnnotation[];
  drawOverlaySize: { w: number; h: number } | null;
  thumb: string | null;
};

export type PersistedProjectFile = {
  version: 1;
  updatedAt: string;
  pages: PersistedPage[];
  curIdx: number;
};

type Store = Record<string, PersistedProjectFile>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  const s = JSON.stringify(store);
  if (s.length > 4_500_000) {
    throw new Error(
      "프로젝트 용량이 브라우저 저장 한도에 가깝습니다. 이미지 수·해상도를 줄여 주세요.",
    );
  }
  localStorage.setItem(STORAGE_KEY, s);
}

export function listProjectsMeta(): { name: string; updatedAt: string }[] {
  const store = readStore();
  return Object.entries(store)
    .map(([name, file]) => ({
      name,
      updatedAt: file.updatedAt,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadPersistedProject(
  name: string,
): PersistedProjectFile | null {
  const store = readStore();
  return store[name.trim()] ?? null;
}

export function deletePersistedProject(name: string) {
  const store = readStore();
  delete store[name.trim()];
  writeStore(store);
}

export function savePersistedProject(
  name: string,
  file: PersistedProjectFile,
) {
  const key = name.trim();
  if (!key) throw new Error("프로젝트 이름이 비어 있습니다.");
  const store = readStore();
  store[key] = file;
  writeStore(store);
}

function emptyPersistedPage(id: number): PersistedPage {
  return {
    id,
    imageDataUrl: null,
    W: 0,
    H: 0,
    meta: defMeta(),
    markers: [],
    strokes: [],
    textNotes: [],
    drawOverlaySize: null,
    thumb: null,
  };
}

export function createEmptyPersistedProject(): PersistedProjectFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    pages: [emptyPersistedPage(Date.now())],
    curIdx: 0,
  };
}

export function serializePage(page: CinemaPage): PersistedPage {
  let imageDataUrl: string | null = null;
  if (page.W > 0 && page.H > 0) {
    const c = document.createElement("canvas");
    c.width = page.W;
    c.height = page.H;
    const cx = c.getContext("2d");
    if (cx) {
      if (page.imgEl && page.imgEl.complete) {
        try {
          cx.drawImage(page.imgEl, 0, 0);
          imageDataUrl = c.toDataURL("image/jpeg", 0.82);
        } catch {
          /* ignore */
        }
      }
      if (!imageDataUrl && page.px) {
        try {
          cx.putImageData(page.px, 0, 0);
          imageDataUrl = c.toDataURL("image/jpeg", 0.82);
        } catch {
          /* ignore */
        }
      }
    }
  }

  return {
    id: page.id,
    imageDataUrl,
    W: page.W,
    H: page.H,
    meta: { ...page.meta },
    markers: page.markers.map((m) => ({ ...m })),
    strokes: page.strokes.map((s) => ({
      ...s,
      points: s.points.map((pt) => ({ ...pt })),
    })),
    textNotes: page.textNotes.map((t) => ({ ...t })),
    drawOverlaySize: page.drawOverlaySize
      ? { ...page.drawOverlaySize }
      : null,
    thumb: page.thumb,
  };
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("이미지 로드 실패"));
    im.src = url;
  });
}

export async function persistedPagesToRuntime(
  persisted: PersistedPage[],
): Promise<CinemaPage[]> {
  const out: CinemaPage[] = [];
  for (const p of persisted) {
    if (!p.imageDataUrl || !p.W || !p.H) {
      out.push({
        id: p.id,
        imageURL: null,
        imgEl: null,
        px: null,
        W: 0,
        H: 0,
        meta: { ...p.meta },
        markers: p.markers.map((m) => ({ ...m })),
        strokes: p.strokes.map((s) => ({
          ...s,
          points: s.points.map((pt) => ({ ...pt })),
        })),
        textNotes: p.textNotes.map((t) => ({ ...t })),
        drawOverlaySize: p.drawOverlaySize
          ? { ...p.drawOverlaySize }
          : null,
        thumb: p.thumb,
      });
      continue;
    }

    const img = await loadImageFromUrl(p.imageDataUrl);
    const tmp = document.createElement("canvas");
    tmp.width = p.W;
    tmp.height = p.H;
    tmp.getContext("2d")!.drawImage(img, 0, 0);
    const px = tmp.getContext("2d")!.getImageData(0, 0, p.W, p.H);

    out.push({
      id: p.id,
      imageURL: p.imageDataUrl,
      imgEl: img,
      px,
      W: p.W,
      H: p.H,
      meta: { ...p.meta },
      markers: p.markers.map((m) => ({ ...m })),
      strokes: p.strokes.map((s) => ({
        ...s,
        points: s.points.map((pt) => ({ ...pt })),
      })),
      textNotes: p.textNotes.map((t) => ({ ...t })),
      drawOverlaySize: p.drawOverlaySize
        ? { ...p.drawOverlaySize }
        : null,
      thumb: p.thumb,
    });
  }
  return out;
}

export function normalizeProjectNameInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
