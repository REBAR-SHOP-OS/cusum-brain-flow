import { type SceneIntelligence } from "@/types/adDirector";
import { Cpu, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SceneIntelligenceBarProps {
  intelligence?: SceneIntelligence;
}

const modelShortNames: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini Pro",
  "openai/gpt-5": "GPT-5",
  "google/gemini-2.5-flash": "Gemini Flash",
  "google/gemini-2.5-flash-lite": "Gemini Lite",
  "openai/gpt-5-mini": "GPT-5 Mini",
};

const modelColors: Record<string, string> = {
  "google/gemini-2.5-pro": "text-blue-400",
  "openai/gpt-5": "text-emerald-400",
  "google/gemini-2.5-flash": "text-amber-400",
  "google/gemini-2.5-flash-lite": "text-orange-400",
  "openai/gpt-5-mini": "text-teal-400",
};

function shortName(model: string) {
  return modelShortNames[model] || model.split("/").pop() || model;
}

function modelColor(model: string) {
  return modelColors[model] || "text-muted-foreground";
}

export function SceneIntelligenceBar({ intelligence }: SceneIntelligenceBarProps) {
  if (!intelligence) return null;

  const steps = [
    { label: "Planned", model: intelligence.plannedBy },
    { label: "Written", model: intelligence.promptWrittenBy },
    ...(intelligence.videoEngine ? [{ label: "Render", model: intelligence.videoEngine }] : []),
  ];

  return (
    <div className="flex items-center gap-1 text-[9px] text-muted-foreground pt-1 border-t border-border/20 mt-2">
      <Cpu className="w-3 h-3 flex-shrink-0" />
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-border" />}
          <span>{step.label}:</span>
          <span className={cn("font-medium", modelColor(step.model))}>
            {shortName(step.model)}
          </span>
        </span>
      ))}
    </div>
  );
}
