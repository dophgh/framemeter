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
  const [projects, setProjects] = useState<ProjectRow[]>([]);

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
                    <button
                      type="button"
                      onClick={() => router.replace(`/?projectId=${encodeURIComponent(String(p.id))}`)}
                      className="h-[28px] rounded-sm border border-[#1c1c1c] bg-[#0d0d0d] px-3 text-[8px] tracking-[1px] text-[#555] disabled:opacity-60"
                      title="2단계에서 프로젝트 불러오기/동기화 작업이 추가됩니다."
                    >
                      OPEN (2nd)
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 text-[9px] text-[#888]">
                저장된 프로젝트가 없습니다.
              </div>
            )}

            <div className="mt-6 text-[9px] text-[#888]">
              이 단계에서는 프로젝트 목록만 로드합니다. (읽기 완료)
            </div>

            <div className="mt-3 text-[9px] text-[#888]">
              다음 단계에서 `pages` 동기화 및 프로젝트 열기 기능을 추가합니다.
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

