import { type PromptQualityScore } from "@/types/adDirector";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptQualityBadgeProps {
  quality?: PromptQualityScore;
  onImprove?: () => void;
  improving?: boolean;
}

export function PromptQualityBadge({ quality, onImprove, improving }: PromptQualityBadgeProps) {
  if (!quality) return null;

  const score = quality.overall;
  const color = score >= 8
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : score >= 7
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-destructive/20 text-destructive border-destructive/30";

  const dimensions = [
    { key: "realism", label: "Realism" },
    { key: "specificity", label: "Specificity" },
    { key: "visualRichness", label: "Visual Richness" },
    { key: "continuityStrength", label: "Continuity" },
    { key: "brandRelevance", label: "Brand Relevance" },
    { key: "emotionalPersuasion", label: "Emotion" },
    { key: "cinematicClarity", label: "Cinematic" },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("text-[10px] border cursor-help", color)}>
              Quality: {score.toFixed(1)}/10
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] space-y-1 p-3">
            <p className="text-xs font-semibold mb-2">Prompt Quality Breakdown</p>
            {dimensions.map(({ key, label }) => (
              <div key={key} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn(
                  "font-mono",
                  quality[key] >= 8 ? "text-emerald-400" : quality[key] >= 7 ? "text-amber-400" : "text-destructive",
                )}>
                  {quality[key].toFixed(1)}
                </span>
              </div>
            ))}
            {quality.suggestion && (
              <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
                {quality.suggestion}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {score < 7 && onImprove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-[10px] text-amber-400 hover:text-amber-300"
          onClick={onImprove}
          disabled={improving}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          {improving ? "Improving…" : "Auto-improve"}
        </Button>
      )}
    </div>
  );
}
