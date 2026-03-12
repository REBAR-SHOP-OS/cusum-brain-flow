import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Zap } from "lucide-react";
import { SceneCard } from "./SceneCard";
import { type StoryboardScene, type ScriptSegment, type ClipOutput } from "@/types/adDirector";

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
}

export function StoryboardTimeline({
  segments, storyboard, clips,
  onPromptChange, onContinuityToggle, onRegenerate, onGenerateAll, generatingAny,
  onImprovePrompt, improvingSceneId,
}: StoryboardTimelineProps) {
  const completedCount = clips.filter(c => c.status === "completed").length;
  const totalCount = storyboard.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Storyboard</h3>
          <Badge variant="outline" className="text-[10px]">
            {completedCount}/{totalCount} scenes
          </Badge>
        </div>
        <Button
          onClick={onGenerateAll}
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
            />
          );
        })}
      </div>
    </div>
  );
}
