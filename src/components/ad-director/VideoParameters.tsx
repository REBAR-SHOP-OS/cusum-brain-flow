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
  duration: 15,
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
    <div className="rounded-lg border border-border/20 bg-card/20 p-3 space-y-3">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        <Film className="w-3.5 h-3.5 text-primary" />
        Video Parameters
      </Label>

      {/* Ratio */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground">Ratio</span>
        <div className="flex flex-wrap gap-1">
          {RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => set("ratio", r)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                params.ratio === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <div className="space-y-1.5 opacity-40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Resolution</span>
          <span className="text-[8px] text-muted-foreground italic">Soon</span>
        </div>
        <div className="flex gap-1">
          {RESOLUTIONS.map((r) => (
            <button key={r} disabled className={cn(
              "flex-1 py-1 rounded text-[10px] font-medium text-center cursor-not-allowed",
              params.resolution === r ? "bg-primary/40 text-primary-foreground" : "bg-muted/20 text-muted-foreground"
            )}>{r}</button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Duration</span>
          <div className="flex rounded overflow-hidden border border-border/20">
            {(["seconds", "frames"] as const).map((u) => (
              <button key={u} onClick={() => set("durationUnit", u)} className={cn(
                "px-2 py-0.5 text-[9px] font-medium transition-colors",
                params.durationUnit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}>{u === "seconds" ? "Sec" : "Fr"}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Slider min={15} max={60} step={15} value={[params.duration]} onValueChange={([v]) => set("duration", v)} className="flex-1" />
          <Input type="number" min={15} max={60} value={params.duration} onChange={(e) => set("duration", Math.min(60, Math.max(15, Number(e.target.value) || 15)))} className="w-12 h-6 text-[11px] text-center bg-muted/20 border-border/20" />
        </div>
      </div>

      {/* Build Qty */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground">Ad Versions</span>
        <div className="flex items-center gap-2">
          <Slider min={1} max={10} step={1} value={[params.buildQty]} onValueChange={([v]) => set("buildQty", v)} className="flex-1" />
          <Input type="number" min={1} max={10} value={params.buildQty} onChange={(e) => set("buildQty", Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className="w-12 h-6 text-[11px] text-center bg-muted/20 border-border/20" />
        </div>
      </div>
    </div>
  );
}
