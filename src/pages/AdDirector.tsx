import { useState, useCallback } from "react";
import { Clapperboard } from "lucide-react";
import { AdDirectorContent } from "@/components/ad-director/AdDirectorContent";
import { AdDirectorSidebar } from "@/components/ad-director/AdDirectorSidebar";
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
        <div className="max-w-6xl mx-auto w-full px-4 pt-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/25 ring-1 ring-white/10">
              <Clapperboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>AI Video Director</h1>
              <p className="text-sm text-muted-foreground">
                Script to cinematic video in minutes
              </p>
            </div>
            <div className="ml-auto hidden sm:block">
              <span className="text-[10px] text-muted-foreground/60 border border-border/30 rounded-full px-3 py-1">
                Powered by multi-model AI pipeline
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto w-full px-4 pb-8 pt-4">
          <AdDirectorContent
            externalLoadProject={loadTrigger}
            onProjectLoaded={() => setLoadTrigger(null)}
            externalActiveTab={activeEditorTab}
            onActiveTabChanged={setActiveEditorTab}
          />
        </div>
      </div>
    </div>
  );
}
