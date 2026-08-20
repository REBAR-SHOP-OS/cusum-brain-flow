import { useState } from "react";
import { Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export interface ClipTransition {
  type: string;
  duration: number;
}

interface TransitionItem {
  id: string;
  label: string;
  gradient: string;
}

const CATEGORIES: { title: string; items: TransitionItem[] }[] = [
  {
    title: "FADES & BLURS",
    items: [
      { id: "None", label: "None", gradient: "bg-muted/40" },
      { id: "Crossfade", label: "Cross fade", gradient: "bg-gradient-to-r from-muted to-foreground/20" },
      { id: "Cross Blur", label: "Cross blur", gradient: "bg-gradient-to-br from-primary/30 to-muted/60" },
      { id: "Fade Black", label: "Fade black", gradient: "bg-gradient-to-r from-background to-foreground/10" },
      { id: "Fade White", label: "Fade white", gradient: "bg-gradient-to-r from-foreground/10 to-muted" },
    ],
  },
  {
    title: "WIPES",
    items: [
      { id: "Wipe Down", label: "Wipe down", gradient: "bg-gradient-to-b from-primary/30 to-muted/50" },
      { id: "Wipe Up", label: "Wipe up", gradient: "bg-gradient-to-t from-primary/30 to-muted/50" },
      { id: "Wipe Left", label: "Wipe left", gradient: "bg-gradient-to-l from-primary/30 to-muted/50" },
      { id: "Wipe Right", label: "Wipe right", gradient: "bg-gradient-to-r from-primary/30 to-muted/50" },
    ],
  },
  {
    title: "MOTION",
    items: [
      { id: "Slide Up", label: "Slide up", gradient: "bg-gradient-to-t from-accent/30 to-secondary/40" },
      { id: "Slide Down", label: "Slide down", gradient: "bg-gradient-to-b from-accent/30 to-secondary/40" },
      { id: "Zoom In", label: "Zoom in", gradient: "bg-gradient-to-br from-primary/20 to-accent/30" },
      { id: "Zoom Out", label: "Zoom out", gradient: "bg-gradient-to-tl from-primary/20 to-accent/30" },
    ],
  },
];

interface ClipTransitionPopoverProps {
  sceneIndex: number;
  current: ClipTransition;
  onChange: (transition: ClipTransition) => void;
}

export function ClipTransitionPopover({ sceneIndex, current, onChange }: ClipTransitionPopoverProps) {
  const [open, setOpen] = useState(false);
  const hasTransition = current.type !== "None";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          title={`Transition after Scene ${sceneIndex + 1}: ${current.type}`}
          className={`absolute bottom-1 right-1 z-30 w-5 h-5 rounded-full flex items-center justify-center
            transition-all border
            ${hasTransition
              ? "bg-primary/80 border-primary text-primary-foreground opacity-90 hover:opacity-100"
              : "bg-black/60 border-white/30 text-white/70 opacity-60 hover:opacity-100 hover:bg-black/80"
            }
          `}
        >
          <Pencil className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-72 p-3 bg-popover border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Transition after Scene {sceneIndex + 1}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Choose how this scene transitions to the next.
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className="space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.title}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {cat.items.map((item) => {
                    const active = current.type === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onChange({ type: item.id, duration: current.duration })}
                        className={`group flex flex-col items-center gap-1 rounded-md p-1 border transition-all ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border/40 hover:border-primary/40 hover:bg-muted/20"
                        }`}
                      >
                        <div className={`w-full aspect-[4/3] rounded ${item.gradient}`} />
                        <span className={`text-[9px] font-medium leading-tight text-center truncate w-full ${active ? "text-primary" : "text-foreground"}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasTransition && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="flex justify-between items-center">
                <Label className="text-[10px]">Duration</Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {current.duration.toFixed(1)}s
                </span>
              </div>
              <Slider
                value={[current.duration]}
                onValueChange={(v) => onChange({ type: current.type, duration: v[0] })}
                min={0.1}
                max={2.0}
                step={0.1}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
