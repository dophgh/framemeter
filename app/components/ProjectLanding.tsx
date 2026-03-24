"use client";

import {
  createEmptyPersistedProject,
  deletePersistedProject,
  listProjectsMeta,
  loadPersistedProject,
  normalizeProjectNameInput,
  savePersistedProject,
} from "@/lib/cinema-persistence";
import { useCallback, useMemo, useState } from "react";

export default function ProjectLanding({
  onOpenProject,
}: {
  onOpenProject: (name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [tick, setTick] = useState(0);

  const projects = useMemo(() => {
    void tick;
    return listProjectsMeta();
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const handleCreate = () => {
    const name = normalizeProjectNameInput(newName);
    if (!name) {
      window.alert("프로젝트 이름을 입력해 주세요.");
      return;
    }
    if (loadPersistedProject(name)) {
      if (
        !window.confirm(
          `「${name}」이(가) 이미 있습니다. 덮어쓰고 새 프로젝트로 시작할까요?`,
        )
      ) {
        return;
      }
    }
    try {
      const file = createEmptyPersistedProject();
      file.updatedAt = new Date().toISOString();
      savePersistedProject(name, file);
      refresh();
      onOpenProject(name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpen = (name: string) => {
    if (!loadPersistedProject(name)) {
      window.alert("프로젝트를 찾을 수 없습니다.");
      refresh();
      return;
    }
    onOpenProject(name);
  };

  const handleDelete = (name: string) => {
    if (!window.confirm(`「${name}」프로젝트를 삭제할까요?`)) return;
    deletePersistedProject(name);
    refresh();
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-10 bg-black px-6 py-16 text-[#bbb]">
      <div className="text-center">
        <h1 className="text-[11px] tracking-[6px] text-[#3a3a3a]">
          FRAME METER
        </h1>
        <p className="mt-3 text-[9px] tracking-[2px] text-[#252525]">
          프로젝트 단위로 작업이 저장됩니다 (이 브라우저 / 이 기기)
        </p>
      </div>

      <div className="w-full max-w-[360px] border border-[#1c1c1c] bg-[#050505] p-5">
        <div className="mb-3 text-[8px] tracking-[3px] text-[#252525]">
          NEW PROJECT
        </div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="프로젝트 이름"
          className="mb-3 w-full border border-[#131313] bg-[#060606] px-3 py-2 text-[10px] text-[#ccc] outline-none placeholder:text-[#333] focus:border-[#333]"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="w-full border border-[#2a2a2a] bg-[#111] py-2 text-[9px] tracking-[2px] text-[#888] hover:border-[#444] hover:text-white"
        >
          CREATE & OPEN
        </button>
      </div>

      <div className="w-full max-w-[360px]">
        <div className="mb-3 text-[8px] tracking-[3px] text-[#252525]">
          OPEN PROJECT
        </div>
        {projects.length === 0 ? (
          <p className="text-[9px] text-[#1c1c1c]">
            저장된 프로젝트가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map(({ name, updatedAt }) => (
              <li
                key={name}
                className="flex items-center gap-2 border border-[#181818] bg-[#080808] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(name)}
                  className="min-w-0 flex-1 truncate text-left text-[10px] text-[#999] hover:text-[#ccc]"
                >
                  {name}
                </button>
                <span className="shrink-0 text-[7px] text-[#333]">
                  {new Date(updatedAt).toLocaleString("ko-KR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(name)}
                  className="shrink-0 px-1 text-[9px] text-[#552222] hover:text-[#ff4444]"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
