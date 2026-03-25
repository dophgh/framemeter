"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type ProjectRow = {
  id: string | number;
  title: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setError(
        "Supabase 설정이 필요합니다. `.env.local`에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가해 주세요.",
      );
      setLoading(false);
      return;
    }

    let alive = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: userErr } =
          await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!alive) return;

        const userId = userData.user?.id;
        setUserId(userId ?? null);
        setEmail(userData.user?.email ?? null);

        if (!userId) {
          setProjects([]);
          return;
        }

        const { data, error: projErr } = await supabase
          .from("projects")
          .select("id,title,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (projErr) throw projErr;
        if (!alive) return;
        setProjects((data as ProjectRow[]) ?? []);
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
  }, [supabase]);

  const goLogin = () => router.replace("/auth/login");

  const refreshProjects = async () => {
    if (!supabase) return;
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: projErr } = await supabase
        .from("projects")
        .select("id,title,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (projErr) throw projErr;
      setProjects((data as ProjectRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!supabase) return;
    if (!userId) {
      setError("로그인이 필요합니다.");
      return;
    }
    const title = newTitle.trim().replace(/\s+/g, " ");
    if (!title) {
      setError("프로젝트 이름을 입력해 주세요.");
      return;
    }

    setCreateBusy(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("projects")
        .insert({ user_id: userId, title })
        .select("id,title,created_at")
        .single();
      if (insErr) throw insErr;

      setNewTitle("");
      const id = data?.id;
      if (!id) throw new Error("프로젝트 생성 결과가 비어 있습니다.");
      router.replace(`/?projectId=${encodeURIComponent(String(id))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const deleteProject = async (id: string | number) => {
    if (!supabase) return;
    if (!userId) return;
    const ok = window.confirm("프로젝트를 삭제할까요?");
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      const { error: delPagesErr } = await supabase
        .from("pages")
        .delete()
        .eq("project_id", id);
      if (delPagesErr) throw delPagesErr;

      const { error: delProjErr } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (delProjErr) throw delProjErr;

      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-[#ccc]">
      <div className="mx-auto w-full max-w-[780px]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[6px] text-[#888]">
              FRAME METER
            </div>
            <div className="mt-3 text-[10px] tracking-[3px] text-[#888]">
              PROJECTS DASHBOARD
            </div>
          </div>
          {email ? (
            <div className="text-[9px] text-[#888]">Signed in</div>
          ) : (
            <button
              type="button"
              onClick={goLogin}
              className="h-[38px] border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
            >
              LOGIN
            </button>
          )}
        </div>

        {error ? (
          <div className="border border-[#2a2a2a] bg-[#090909] px-4 py-3 text-[9px] text-[#ccc]">
            {error}
          </div>
        ) : null}

        {email ? (
          <div className="mb-6">
            <div className="mb-3 text-[8px] tracking-[3px] text-[#888]">
              NEW PROJECT
            </div>
            <div className="flex gap-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="프로젝트 이름"
                className="flex-1 border border-[#131313] bg-[#060606] px-3 py-2 text-[10px] text-[#ccc] outline-none placeholder:text-[#666] focus:border-[#666]"
                onKeyDown={(e) => e.key === "Enter" && void createProject()}
              />
              <button
                type="button"
                disabled={createBusy}
                onClick={() => void createProject()}
                className="h-[40px] whitespace-nowrap border border-[#2a2a2a] bg-[#111] px-[14px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white disabled:pointer-events-none disabled:text-[#666]"
              >
                {createBusy ? "WORKING..." : "CREATE"}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-[9px] text-[#888]">LOADING…</div>
        ) : email ? (
          <div className="mt-6">
            {projects.length ? (
              <ul className="flex flex-col gap-2">
                {projects.map((p) => (
                  <li
                    key={String(p.id)}
                    className="flex items-center gap-3 border border-[#181818] bg-[#080808] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-bold text-[#ccc]">
                        {p.title}
                      </div>
                      <div className="mt-1 text-[7px] text-[#666]">
                        {new Date(p.created_at).toLocaleString("ko-KR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          router.replace(
                            `/?projectId=${encodeURIComponent(
                              String(p.id),
                            )}`,
                          )
                        }
                        className="h-[28px] rounded-sm border border-[#1c1c1c] bg-[#0d0d0d] px-3 text-[8px] tracking-[1px] text-[#555] hover:border-[#666] hover:text-[#fff]"
                        title="프로젝트 열기"
                      >
                        OPEN
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteProject(p.id)}
                        className="h-[28px] w-[28px] rounded-sm border border-transparent bg-[rgba(160,0,0,0.35)] text-white hover:bg-[rgba(220,0,0,0.8)]"
                        aria-label="프로젝트 삭제"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 text-[9px] text-[#888]">
                저장된 프로젝트가 없습니다.
              </div>
            )}

            <div className="mt-6 text-[9px] text-[#888]">
              프로젝트를 열면 현재 편집 상태가 Supabase에 동기화됩니다. (A-3)
            </div>
          </div>
        ) : (
          <div className="mt-10 flex justify-center">
            <div className="max-w-[520px] text-center text-[9px] text-[#888]">
              로그인 후 대시보드에서 프로젝트 목록을 확인할 수 있습니다.
              <div className="mt-4">
                <Link className="hover:text-white" href="/auth/signup">
                  회원가입 →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

