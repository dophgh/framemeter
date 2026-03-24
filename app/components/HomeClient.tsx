"use client";

import { useState } from "react";
import CinemaAnalyzerApp from "@/app/components/CinemaAnalyzerApp";
import ProjectLanding from "@/app/components/ProjectLanding";

export default function HomeClient() {
  const [activeProject, setActiveProject] = useState<string | null>(null);

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
