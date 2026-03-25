"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

export default function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const supabase = useMemo(() => supabaseClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!supabase) return () => void (alive = false);

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) router.replace(next);
    });

    return () => {
      alive = false;
    };
  }, [supabase, router, next]);

  const onLogin = async () => {
    if (!supabase) {
      setMsg(
        "Supabase env가 설정되지 않았습니다. `.env.local`을 설정해 주세요.",
      );
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-[#ccc]">
      <div className="mx-auto w-full max-w-[420px] border border-[#1c1c1c] bg-[#050505] p-6">
        <div className="mb-4 text-[10px] tracking-[4px] text-[#888]">
          FRAME METER
        </div>
        <h1 className="text-[12px] tracking-[3px] text-[#ccc]">LOGIN</h1>
        <p className="mt-2 text-[9px] text-[#888]">
          이메일과 비밀번호로 로그인합니다.
        </p>
        {!supabase ? (
          <div className="mt-4 border border-[#2a2a2a] bg-[#090909] px-3 py-2 text-[9px] text-[#ccc]">
            Supabase 설정이 필요합니다. `.env.local`에{" "}
            <span className="text-white">NEXT_PUBLIC_SUPABASE_URL</span>,{" "}
            <span className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>를
            추가해 주세요.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            inputMode="email"
            autoComplete="email"
            className="w-full border border-[#131313] bg-[#060606] px-3 py-2 text-[10px] text-[#ccc] outline-none placeholder:text-[#666] focus:border-[#666]"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="w-full border border-[#131313] bg-[#060606] px-3 py-2 text-[10px] text-[#ccc] outline-none placeholder:text-[#666] focus:border-[#666]"
          />

          {msg ? (
            <div className="border border-[#2a2a2a] bg-[#090909] px-3 py-2 text-[9px] text-[#ccc]">
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={onLogin}
            className="w-full border border-[#2a2a2a] bg-[#111] py-2 text-[9px] tracking-[2px] text-[#ccc] hover:border-[#666] hover:text-white disabled:pointer-events-none disabled:text-[#666]"
          >
            {busy ? "WORKING..." : "LOGIN"}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between text-[9px] text-[#888]">
          <Link
            className="hover:text-white"
            href={`/auth/signup?next=${encodeURIComponent(next)}`}
          >
            회원가입 →
          </Link>
          <Link className="hover:text-white" href="/">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

