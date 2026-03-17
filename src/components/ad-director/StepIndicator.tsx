import { FileText, Layers, Film, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScriptSegment, StoryboardScene, ClipOutput } from "@/types/adDirector";

type WorkflowStep = "script" | "storyboard" | "preview";

const steps: { id: WorkflowStep; label: string; icon: React.ReactNode }[] = [
  { id: "script", label: "Script & Assets", icon: <FileText className="w-4 h-4" /> },
  { id: "storyboard", label: "Storyboard", icon: <Layers className="w-4 h-4" /> },
  { id: "preview", label: "Preview & Export", icon: <Film className="w-4 h-4" /> },
];

interface StepIndicatorProps {
  step: WorkflowStep;
  onStepChange: (s: WorkflowStep) => void;
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  clips: ClipOutput[];
}

export function StepIndicator({ step, onStepChange, segments, storyboard, clips }: StepIndicatorProps) {
  const stepOrder: WorkflowStep[] = ["script", "storyboard", "preview"];
  const currentIdx = stepOrder.indexOf(step);
  const completedClips = clips.filter(c => c.status === "completed").length;

  const getContextBadge = (id: WorkflowStep) => {
    if (id === "storyboard" && storyboard.length > 0) {
      return `${storyboard.length} scenes`;
    }
    if (id === "preview" && completedClips > 0) {
      return completedClips === storyboard.length ? "Ready" : `${completedClips}/${storyboard.length}`;
    }
    return null;
  };

  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center gap-1">
        {steps.map((s, idx) => {
          const thisIdx = stepOrder.indexOf(s.id);
          const isCompleted = thisIdx < currentIdx;
          const isActive = s.id === step;
          const isDisabled =
            (s.id === "storyboard" && segments.length === 0) ||
            (s.id === "preview" && storyboard.length === 0);
          const badge = getContextBadge(s.id);

          return (
            <div key={s.id} className="flex items-center gap-1">
              {idx > 0 && (
                <div
                  className={cn(
                    "w-8 h-0.5 rounded-full transition-colors",
                    isCompleted || isActive ? "bg-primary" : "bg-border/40"
                  )}
                />
              )}
              <button
                onClick={() => !isDisabled && onStepChange(s.id)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all relative",
                  isActive && "bg-primary/10 text-primary border border-primary/30 shadow-sm shadow-primary/10",
                  isCompleted && !isActive && "text-emerald-400 hover:bg-emerald-500/10",
                  !isActive && !isCompleted && "text-muted-foreground hover:text-foreground hover:bg-muted/20",
                  isDisabled && "opacity-30 cursor-not-allowed"
                )}
              >
                {isCompleted ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                ) : (
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>
                )}
                <span className="hidden sm:inline">{s.label}</span>
                {badge && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] px-1.5 py-0 h-4 ml-1",
                      isActive && "bg-primary/20 text-primary border-primary/30"
                    )}
                  >
                    {badge}
                  </Badge>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
