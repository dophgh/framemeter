"use client";

import { useState } from "react";
import { useEffect } from "react";
import CinemaAnalyzerApp from "@/app/components/CinemaAnalyzerApp";
import ProjectLanding from "@/app/components/ProjectLanding";
import DbOpenProject from "@/app/components/DbOpenProject";

export default function HomeClient() {
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [dbProjectId, setDbProjectId] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("projectId");
    if (pid) setDbProjectId(pid);
  }, []);

  const leaveDbProject = () => {
    setDbProjectId(null);
    setActiveProject(null);
    window.history.replaceState({}, "", "/");
  };

  if (dbProjectId) {
    return (
      <DbOpenProject
        projectId={dbProjectId}
        onLeaveProject={leaveDbProject}
      />
    );
  }

  if (!activeProject) {
    return <ProjectLanding onOpenProject={setActiveProject} />;
  }

  return (
    <CinemaAnalyzerApp
      key={activeProject}
      projectName={activeProject}
      onLeaveProject={() => setActiveProject(null)}
    />
  );
}
