import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Monitor, Film } from "lucide-react";

export interface VideoParams {
  ratio: string;
  resolution: string;
  duration: number;
  durationUnit: "seconds" | "frames";
  buildQty: number;
}

export const DEFAULT_VIDEO_PARAMS: VideoParams = {
  ratio: "16:9",
  resolution: "720p",
  duration: 5,
  durationUnit: "seconds",
  buildQty: 1,
};

const RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "Smart"];
const RESOLUTIONS = ["480p", "720p", "1080p"];

interface VideoParametersProps {
  params: VideoParams;
  onChange: (p: VideoParams) => void;
}

export function VideoParameters({ params, onChange }: VideoParametersProps) {
  const set = <K extends keyof VideoParams>(key: K, val: VideoParams[K]) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 ring-1 ring-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <Film className="w-4 h-4 text-primary" />
        <Label className="text-sm font-medium">Video Parameters</Label>
      </div>

      {/* Ratio */}
      <div className="space-y-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ratio</span>
        <div className="flex flex-wrap gap-1">
          {RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => set("ratio", r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all",
                params.ratio === r
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/50 text-muted-foreground border-border/30 hover:border-primary/40 hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution (coming soon) */}
      <div className="space-y-2 opacity-50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolution</span>
          <span className="text-[8px] text-muted-foreground italic">Coming soon</span>
        </div>
        <div className="flex gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              disabled
              className={cn(
                "flex-1 py-1.5 rounded-md text-[10px] font-medium border transition-all text-center cursor-not-allowed",
                params.resolution === r
                  ? "bg-primary/50 text-primary-foreground border-primary/50"
                  : "bg-background/50 text-muted-foreground border-border/30"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</span>
          <div className="flex rounded-md border border-border/30 overflow-hidden">
            {(["seconds", "frames"] as const).map((u) => (
              <button
                key={u}
                onClick={() => set("durationUnit", u)}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-medium transition-colors",
                  params.durationUnit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {u === "seconds" ? "Sec" : "Fr"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            min={2}
            max={15}
            step={1}
            value={[params.duration]}
            onValueChange={([v]) => set("duration", v)}
            className="flex-1"
          />
          <Input
            type="number"
            min={2}
            max={15}
            value={params.duration}
            onChange={(e) => set("duration", Math.min(15, Math.max(2, Number(e.target.value) || 2)))}
            className="w-14 h-7 text-xs text-center bg-background/50"
          />
        </div>
      </div>

      {/* Build Quantity (coming soon) */}
      <div className="space-y-2 opacity-50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Build Quantity</span>
          <span className="text-[8px] text-muted-foreground italic">Coming soon</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            min={1}
            max={4}
            step={1}
            value={[params.buildQty]}
            disabled
            className="flex-1"
          />
          <span className="text-xs font-medium w-6 text-center">{params.buildQty}</span>
        </div>
      </div>
    </div>
  );
}
