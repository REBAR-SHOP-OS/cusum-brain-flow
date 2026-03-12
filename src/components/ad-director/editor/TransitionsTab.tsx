import { useState } from "react";
import { Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface TransitionsTabProps {
  activeTransition: string;
  onSelect: (transition: string) => void;
  duration?: number;
  onDurationChange?: (d: number) => void;
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
      { id: "Fade Black", label: "Fade through black", gradient: "bg-gradient-to-r from-background to-foreground/10" },
      { id: "Fade White", label: "Fade through white", gradient: "bg-gradient-to-r from-foreground/10 to-muted" },
      { id: "Burn", label: "Burn", gradient: "bg-gradient-to-br from-destructive/40 to-warning/30" },
      { id: "Tiles", label: "Tiles", gradient: "bg-gradient-to-br from-accent/40 to-primary/20" },
    ],
  },
  {
    title: "WIPES",
    items: [
      { id: "Wipe Down", label: "Hard wipe down", gradient: "bg-gradient-to-b from-primary/30 to-muted/50" },
      { id: "Wipe Up", label: "Hard wipe up", gradient: "bg-gradient-to-t from-primary/30 to-muted/50" },
      { id: "Wipe Left", label: "Hard wipe left", gradient: "bg-gradient-to-l from-primary/30 to-muted/50" },
      { id: "Wipe Right", label: "Hard wipe right", gradient: "bg-gradient-to-r from-primary/30 to-muted/50" },
    ],
  },
  {
    title: "MOTION",
    items: [
      { id: "Slide Up", label: "Slide up", gradient: "bg-gradient-to-t from-accent/30 to-secondary/40" },
      { id: "Slide Down", label: "Slide down", gradient: "bg-gradient-to-b from-accent/30 to-secondary/40" },
      { id: "Zoom In", label: "Zoom in", gradient: "bg-gradient-to-br from-primary/20 to-accent/30" },
      { id: "Zoom Out", label: "Zoom out", gradient: "bg-gradient-to-tl from-primary/20 to-accent/30" },
      { id: "Horizontal Banding", label: "Horizontal banding", gradient: "bg-gradient-to-r from-muted/30 via-primary/20 to-muted/30" },
    ],
  },
];

const ALL_ITEMS = CATEGORIES.flatMap(c => c.items);

export function TransitionsTab({ activeTransition, onSelect, duration = 0.5, onDurationChange }: TransitionsTabProps) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase().trim();

  const filtered = CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(i => !q || i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
  })).filter(cat => cat.items.length > 0);

  const selectedLabel = ALL_ITEMS.find(i => i.id === activeTransition)?.label;

  return (
    <div className="space-y-3 p-1">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search transitions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded-md text-xs pl-8 pr-3 h-8 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
        />
      </div>

      {/* Grid by category */}
      <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {filtered.map(cat => (
          <div key={cat.title} className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              {cat.title}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cat.items.map(item => {
                const active = activeTransition === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`group flex flex-col items-center gap-1.5 rounded-lg p-1.5 border transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.25)]"
                        : "border-border/30 hover:border-primary/40 hover:bg-muted/20"
                    }`}
                  >
                    <div className={`w-full aspect-[4/3] rounded-md ${item.gradient} transition-transform group-hover:scale-[1.03]`} />
                    <span className={`text-[10px] font-medium leading-tight text-center ${active ? "text-primary" : "text-foreground"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Duration slider */}
      {activeTransition !== "None" && onDurationChange && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="flex justify-between items-center">
            <Label className="text-xs">Duration</Label>
            <span className="text-[10px] text-muted-foreground font-mono">{duration.toFixed(1)}s</span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={v => onDurationChange(v[0])}
            min={0.1}
            max={2.0}
            step={0.1}
          />
          {selectedLabel && (
            <p className="text-[10px] text-muted-foreground">
              Active: <span className="text-foreground font-medium">{selectedLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
