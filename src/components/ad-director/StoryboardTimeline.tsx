import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Zap, DollarSign, RotateCcw } from "lucide-react";
import { SceneCard } from "./SceneCard";
import { type StoryboardScene, type ScriptSegment, type ClipOutput, type GenerationMode } from "@/types/adDirector";

const COST_PER_MODE: Record<GenerationMode, number> = {
  "text-to-video": 0.38,
  "image-to-video": 0.38,
  "reference-continuation": 0.38,
  "static-card": 0.00,
  "motion-graphics": 0.10,
};

const MODE_LABELS: Record<GenerationMode, string> = {
  "text-to-video": "T2V",
  "image-to-video": "I2V",
  "reference-continuation": "Ref",
  "static-card": "Card",
  "motion-graphics": "MoGfx",
};

function getSceneCost(scene: StoryboardScene): number {
  return COST_PER_MODE[scene.generationMode] ?? 0.38;
}

interface StoryboardTimelineProps {
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  clips: ClipOutput[];
  onPromptChange: (id: string, prompt: string) => void;
  onContinuityToggle: (id: string) => void;
  onRegenerate: (id: string) => void;
  onGenerateAll: () => void;
  generatingAny: boolean;
  onImprovePrompt?: (id: string) => void;
  improvingSceneId?: string | null;
  logoUrl?: string | null;
  onPromptUndo?: (id: string) => void;
  canUndoPrompt?: (id: string) => boolean;
}

export function StoryboardTimeline({
  segments, storyboard, clips,
  onPromptChange, onContinuityToggle, onRegenerate, onGenerateAll, generatingAny,
  onImprovePrompt, improvingSceneId, logoUrl, onPromptUndo, canUndoPrompt,
}: StoryboardTimelineProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completedCount = clips.filter(c => c.status === "completed").length;
  const failedCount = clips.filter(c => c.status === "failed").length;
  const totalCount = storyboard.length;

  const totalCost = storyboard.reduce((sum, s) => sum + getSceneCost(s), 0);
  const totalDuration = segments.reduce((max, s) => Math.max(max, s.endTime), 0);
  const videoSceneCount = storyboard.filter(s => s.generationMode !== "static-card").length;

  const handleRetryAllFailed = () => {
    const failedSceneIds = clips.filter(c => c.status === "failed").map(c => c.sceneId);
    failedSceneIds.forEach(id => onRegenerate(id));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Storyboard</h3>
          <Badge variant="outline" className="text-[10px]">
            {completedCount}/{totalCount} scenes
          </Badge>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <DollarSign className="w-3 h-3" />
              Est. ${totalCost.toFixed(2)} · {videoSceneCount} video{videoSceneCount !== 1 ? "s" : ""} · {totalDuration}s
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 && !generatingAny && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleRetryAllFailed}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry {failedCount} failed
            </Button>
          )}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              disabled={generatingAny || totalCount === 0}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 text-xs h-8"
            >
              {generatingAny ? (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Generate All Scenes
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cost Estimate — Generate All Scenes</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Review the estimated cost before starting generation.
                  </p>
                  <div className="rounded-md border divide-y text-sm">
                    {storyboard.map((scene, i) => {
                      const seg = segments.find(s => s.id === scene.segmentId);
                      const cost = getSceneCost(scene);
                      return (
                        <div key={scene.id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-foreground">
                            Scene {i + 1}{" "}
                            <span className="text-muted-foreground">
                              ({MODE_LABELS[scene.generationMode]}) — {seg?.label ?? scene.id}
                            </span>
                          </span>
                          <span className={cost === 0 ? "text-muted-foreground" : "text-foreground font-medium"}>
                            {cost === 0 ? "Free" : `$${cost.toFixed(2)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted font-semibold text-sm">
                    <span>Total ({totalDuration}s video)</span>
                    <span className="text-primary">${totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setConfirmOpen(false); onGenerateAll(); }}
                className="bg-primary"
              >
                <Play className="w-4 h-4 mr-1" />
                Start Generation — ${totalCost.toFixed(2)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {storyboard.map((scene, i) => {
          const segment = segments.find(s => s.id === scene.segmentId);
          const clip = clips.find(c => c.sceneId === scene.id) || {
            sceneId: scene.id, status: "idle" as const, progress: 0,
          };
          return (
            <SceneCard
              key={scene.id}
              scene={scene}
              clip={clip}
              index={i}
              startTime={segment?.startTime ?? 0}
              endTime={segment?.endTime ?? 0}
              segmentLabel={segment?.label ?? scene.id}
              onPromptChange={onPromptChange}
              onContinuityToggle={onContinuityToggle}
              onRegenerate={onRegenerate}
              canRegenerate={!generatingAny}
              onImprovePrompt={onImprovePrompt}
              improvingSceneId={improvingSceneId}
              logoUrl={logoUrl}
            />
          );
        })}
      </div>
    </div>
  );
}
