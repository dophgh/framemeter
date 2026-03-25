"use client";

import { useEffect, useMemo, useState } from "react";
import DbOpenProject from "@/app/components/DbOpenProject";
import { AuthStatusControls } from "@/app/components/AuthStatusControls";
import { supabaseClient } from "@/lib/supabase/client";

export default function HomeClient() {
  const [dbProjectId, setDbProjectId] = useState<string | null>(null);
  const supabase = useMemo(() => supabaseClient(), []);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("projectId");
    if (pid) setDbProjectId(pid);
    setChecking(false);
  }, []);

  const leaveDbProject = () => {
    setDbProjectId(null);
    window.history.replaceState({}, "", "/");
  };

  useEffect(() => {
    if (dbProjectId) return;
    if (!supabase) {
      setChecking(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data.session) {
          setChecking(false);
          window.location.replace("/dashboard");
          return;
        }
        setChecking(false);
      } catch {
        if (!alive) return;
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dbProjectId, supabase]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black">
        <div className="flex min-h-screen items-center justify-center text-[9px] tracking-[3px] text-[#888]">
          LOADING…
        </div>
      </div>
    );
  }

  if (dbProjectId) {
    return (
      <DbOpenProject projectId={dbProjectId} onLeaveProject={leaveDbProject} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black px-6 py-16 text-[#ccc]">
      <header className="flex h-[38px] shrink-0 items-center border-b border-[#1c1c1c] bg-[#030303]">
        <div className="flex h-full items-center border-r border-[#1c1c1c] px-[14px] text-[11px] tracking-[4px] text-[#888]">
          FRAME METER
        </div>
        <div className="flex-1" />
        <AuthStatusControls />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-[9px] text-[#888]">
          로그인 후 대시보드에서 프로젝트를 관리하세요.
        </div>
      </div>
    </div>
  );
}
