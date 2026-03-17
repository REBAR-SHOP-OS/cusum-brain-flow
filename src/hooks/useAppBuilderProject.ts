import { useState, useCallback } from "react";
import { SAMPLE_PROJECT, EMPTY_PROJECT, type AppBuilderProject } from "@/data/appBuilderMockData";

export type SidebarSection = "overview" | "plan" | "pages" | "data-model" | "preview" | "versions" | "export" | "settings";

export function useAppBuilderProject(projectId: string | undefined) {
  const [project, setProject] = useState<AppBuilderProject>(
    projectId === "contractor-crm" ? SAMPLE_PROJECT : { ...EMPTY_PROJECT, id: projectId ?? "new" }
  );
  const [activeSection, setActiveSection] = useState<SidebarSection>("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState(0);

  const generatePlan = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    // Simulate AI generation with delay
    await new Promise((r) => setTimeout(r, 2000));
    setProject((prev) => ({
      ...prev,
      ...SAMPLE_PROJECT,
      id: prev.id,
      name: prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt,
      status: "ready",
    }));
    setIsGenerating(false);
    setActiveSection("plan");
  }, []);

  return {
    project,
    activeSection,
    setActiveSection,
    isGenerating,
    generatePlan,
    selectedPreviewPage,
    setSelectedPreviewPage,
  };
}
