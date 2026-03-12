import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Shapes, Star, Heart, ArrowRight, Circle, Square, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { label: "Shapes", icon: <Shapes className="w-5 h-5" /> },
  { label: "Arrows", icon: <ArrowRight className="w-5 h-5" /> },
  { label: "Stars", icon: <Star className="w-5 h-5" /> },
  { label: "Hearts", icon: <Heart className="w-5 h-5" /> },
  { label: "Circles", icon: <Circle className="w-5 h-5" /> },
  { label: "Squares", icon: <Square className="w-5 h-5" /> },
  { label: "Callouts", icon: <Zap className="w-5 h-5" /> },
];

export function GraphicsTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Graphics & Stickers</h4>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search graphics…"
          className="h-8 text-xs pl-8 bg-muted/30"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => toast({ title: "Coming soon", description: `${cat.label} graphics` })}
            className="aspect-square rounded-lg bg-muted/40 border border-border/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {cat.icon}
            <span className="text-[8px]">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
