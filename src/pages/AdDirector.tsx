import { useState, useCallback } from "react";
import { Clapperboard } from "lucide-react";
import { AdDirectorContent } from "@/components/ad-director/AdDirectorContent";
import { AdDirectorSidebar } from "@/components/ad-director/AdDirectorSidebar";
import { AdDirectorErrorBoundary } from "@/components/ad-director/AdDirectorErrorBoundary";
import type { AdProjectRow } from "@/hooks/useAdProjectHistory";

export default function AdDirector() {
  const [loadTrigger, setLoadTrigger] = useState<AdProjectRow | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<string | null>(null);

  const handleLoadProject = useCallback((project: AdProjectRow) => {
    setLoadTrigger(project);
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <AdDirectorSidebar onLoadProject={handleLoadProject} onNavigateTab={setActiveEditorTab} activeTab={activeEditorTab} />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="max-w-6xl mx-auto w-full px-4 pt-4 pb-1">
          <div className="flex items-center gap-3">
            <Clapperboard className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">AI Video Director</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">— Script to video</span>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto w-full px-4 pb-8 pt-4">
          <AdDirectorErrorBoundary>
            <AdDirectorContent
              externalLoadProject={loadTrigger}
              onProjectLoaded={() => setLoadTrigger(null)}
              externalActiveTab={activeEditorTab}
              onActiveTabChanged={setActiveEditorTab}
            />
          </AdDirectorErrorBoundary>
        </div>
      </div>
    </div>
  );
}
