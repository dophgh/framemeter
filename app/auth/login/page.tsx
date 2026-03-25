import { Suspense } from "react";
import LoginInner from "./LoginInner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black px-6 py-16 text-[#888]">
          <div className="mx-auto w-full max-w-[420px] border border-[#1c1c1c] bg-[#050505] p-6">
            <div className="text-[10px] tracking-[4px]">FRAME METER</div>
            <div className="mt-4 text-[9px]">LOADING…</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

