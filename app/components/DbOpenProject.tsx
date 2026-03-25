"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import type { CinemaPage, DrawStroke, FilmMeta, Marker, TextAnnotation } from "@/lib/cinema-types";
import { defMeta } from "@/lib/cinema-analysis";
import CinemaAnalyzerApp from "@/app/components/CinemaAnalyzerApp";

type DbProjectRow = {
  id: number | string;
  title: string;
};

type DbPageRow = {
  id: number | string;
  image_url: string | null;
  meta: FilmMeta | null;
  markers: Marker[] | null;
  strokes: DrawStroke[] | null;
  notes: TextAnnotation[] | null;
};

async function loadImageAndPixels(
  url: string,
): Promise<{
  imgEl: HTMLImageElement;
  px: ImageData;
  W: number;
  H: number;
  thumb: string | null;
}> {
  const imgEl = new Image();
  imgEl.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    imgEl.onload = () => resolve();
    imgEl.onerror = () => reject(new Error("이미지 로드 실패"));
    imgEl.src = url;
  });

  const W = imgEl.naturalWidth;
  const H = imgEl.naturalHeight;

  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  tmp.getContext("2d")!.drawImage(imgEl, 0, 0);
  const px = tmp.getContext("2d")!.getImageData(0, 0, W, H);

  const tc2 = document.createElement("canvas");
  tc2.width = 280;
  tc2.height = 158;
  tc2.getContext("2d")!.drawImage(imgEl, 0, 0, 280, 158);
  const thumb = tc2.toDataURL("image/jpeg", 0.75);

  return { imgEl, px, W, H, thumb };
}

export default function DbOpenProject({
  projectId,
  onLeaveProject,
}: {
  projectId: string;
  onLeaveProject: () => void;
}) {
  const supabase = useMemo(() => supabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("PROJECT");
  const [pages, setPages] = useState<CinemaPage[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!supabase) {
        setError(
          "Supabase 설정이 필요합니다. `.env.local`에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가해 주세요.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPages([]);
      try {
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data.session) {
          const nextUrl = `/?projectId=${encodeURIComponent(projectId)}`;
          window.location.replace(
            `/auth/login?next=${encodeURIComponent(nextUrl)}`,
          );
          alive = false;
          return;
        }
        const userId = sessionRes.data.session.user.id;

        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .select("id,title")
          .eq("id", projectId)
          .single();
        if (projErr) throw projErr;
        if (!proj) throw new Error("프로젝트를 찾을 수 없습니다.");

        const { data: rows, error: pagesErr } = await supabase
          .from("pages")
          .select("id,image_url,meta,markers,strokes,notes")
          .eq("project_id", projectId)
          .order("id", { ascending: true });
        if (pagesErr) throw pagesErr;

        const dbPages = (rows as DbPageRow[]) ?? [];
        const mapped: CinemaPage[] = [];

        for (const row of dbPages) {
          const pageId =
            typeof row.id === "string" ? Number(row.id) || Date.now() : row.id;

          if (row.image_url) {
            const loaded = await loadImageAndPixels(row.image_url);
            mapped.push({
              id: pageId,
              imageURL: row.image_url,
              imgEl: loaded.imgEl,
              px: loaded.px,
              W: loaded.W,
              H: loaded.H,
              sourceImageURL: null,
              sourceW: loaded.W,
              sourceH: loaded.H,
              cropApplied: false,
              cropRatioLabel: null,
              meta: row.meta ?? defMeta(),
              markers: row.markers ?? [],
              strokes: row.strokes ?? [],
              textNotes: row.notes ?? [],
              drawOverlaySize: null,
              thumb: loaded.thumb,
            });
          } else {
            mapped.push({
              id: pageId,
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
              meta: row.meta ?? defMeta(),
              markers: row.markers ?? [],
              strokes: row.strokes ?? [],
              textNotes: row.notes ?? [],
              drawOverlaySize: null,
              thumb: null,
            });
          }
        }

        if (!alive) return;
        setProjectTitle((proj as any)?.title || "PROJECT");
        setDbUserId(userId);
        setPages(mapped.length ? mapped : [createEmptyPageFallback()]);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [projectId, supabase]);

  // createEmptyPage는 CinemaAnalyzerApp 내부 함수라 여기서 안전한 fallback만 제공합니다.
  const createEmptyPageFallback = (): CinemaPage => ({
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
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-6 py-16 text-[#888]">
        <div className="mx-auto w-full max-w-[420px] border border-[#1c1c1c] bg-[#050505] p-6">
          <div className="text-[10px] tracking-[4px]">FRAME METER</div>
          <div className="mt-4 text-[9px]">LOADING PROJECT…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black px-6 py-16 text-[#ccc]">
        <div className="mx-auto w-full max-w-[720px] border border-[#2a2a2a] bg-[#050505] p-6">
          <div className="text-[12px] text-[#ccc]">DB Project Load Error</div>
          <div className="mt-3 text-[9px] text-[#888]">{error}</div>
          <button
            type="button"
            onClick={onLeaveProject}
            className="mt-6 h-[38px] border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <CinemaAnalyzerApp
      key={projectId}
      projectName={projectTitle}
      onLeaveProject={onLeaveProject}
      initialPages={pages}
      initialCurIdx={0}
      skipPersistence
      dbProjectId={projectId}
      dbUserId={dbUserId ?? undefined}
    />
  );
}

