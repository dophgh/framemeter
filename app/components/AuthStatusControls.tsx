"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

export function AuthStatusControls({
  className = "",
}: {
  className?: string;
}) {
  const [nextUrl, setNextUrl] = useState("/");

  const supabase = useMemo(() => supabaseClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNextUrl(`${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setEmail(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setEmail(data.session?.user?.email ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setEmail(null);
        setLoading(false);
      });

    // onAuthStateChange 구독을 제거: 여러 컴포넌트에서 중복 구독되면 auth 상태가 꼬일 수 있음
    return () => {
      alive = false;
    };
  }, [supabase]);

  const onLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert(error.message);
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className={`flex items-center gap-[10px] ${className}`}>
      {loading ? (
        <span className="text-[9px] tracking-[2px] text-[#666]">AUTH…</span>
      ) : email ? (
        <>
          <div className="min-w-0 max-w-[180px] truncate text-[9px] text-[#ccc]">
            {email}
          </div>
          <a
            href="/dashboard"
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            DASHBOARD
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="h-[38px] border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            LOGOUT
          </button>
        </>
      ) : (
        <>
          <a
            href={`/auth/login?next=${encodeURIComponent(nextUrl)}`}
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            LOGIN
          </a>
          <a
            href={`/auth/signup?next=${encodeURIComponent(nextUrl)}`}
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            SIGNUP
          </a>
        </>
      )}
    </div>
  );
}

