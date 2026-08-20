import { useState } from "react";
import { Glasses } from "lucide-react";
import { GlassesCaptureForm } from "@/components/glasses/GlassesCaptureForm";
import { GlassesCaptureHistory } from "@/components/glasses/GlassesCaptureHistory";

export default function GlassesCapture() {
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Glasses className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vizzy Glasses</h1>
          <p className="text-xs text-muted-foreground">Capture & analyze shop floor photos</p>
        </div>
      </div>

      <GlassesCaptureForm
        onCapture={(analysis) => setLastAnalysis(analysis)}
      />

      {lastAnalysis && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary mb-2">Latest Analysis</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{lastAnalysis}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-foreground mb-3">Recent Captures</h2>
        <GlassesCaptureHistory />
      </div>
    </div>
  );
}
