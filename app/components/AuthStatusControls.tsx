"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

export function AuthStatusControls({
  className = "",
}: {
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const next = `${pathname}${
    typeof window !== "undefined" ? window.location.search : ""
  }`;

  const supabase = useMemo(() => supabaseClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setEmail(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEmail(session?.user?.email ?? null);
        setLoading(false);
      },
    );

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const onLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert(error.message);
      return;
    }
    router.replace("/");
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
          <Link
            href="/dashboard"
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            DASHBOARD
          </Link>
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
          <Link
            href={`/auth/login?next=${encodeURIComponent(next)}`}
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            LOGIN
          </Link>
          <Link
            href={`/auth/signup?next=${encodeURIComponent(next)}`}
            className="h-[38px] flex items-center border border-[#1c1c1c] bg-[#0d0d0d] px-[12px] text-[9px] tracking-[2px] text-[#888] hover:border-[#666] hover:text-white"
          >
            SIGNUP
          </Link>
        </>
      )}
    </div>
  );
}

