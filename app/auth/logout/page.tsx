"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const supabase = useMemo(() => supabaseClient(), []);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!supabase) {
      setErr(
        "Supabase env가 설정되지 않았습니다. `.env.local`을 설정해 주세요.",
      );
      setDone(true);
      return () => {
        alive = false;
      };
    }
    supabase.auth
      .signOut()
      .then(({ error }) => {
        if (!alive) return;
        if (error) setErr(error.message);
        setDone(true);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e));
        setDone(true);
      });
    return () => {
      alive = false;
    };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-[#ccc]">
      <div className="mx-auto w-full max-w-[420px] border border-[#1c1c1c] bg-[#050505] p-6">
        <div className="text-[10px] tracking-[4px] text-[#888]">
          FRAME METER
        </div>
        <div className="mt-4 text-[9px] text-[#888]">
          {done ? "로그아웃되었습니다." : "로그아웃 중..."}
        </div>
        {err ? (
          <div className="mt-3 border border-[#2a2a2a] bg-[#090909] px-3 py-2 text-[9px] text-[#ccc]">
            {err}
          </div>
        ) : null}
        <div className="mt-5 flex gap-3 text-[9px] text-[#888]">
          <Link className="hover:text-white" href="/auth/login">
            로그인
          </Link>
          <Link className="hover:text-white" href="/">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

