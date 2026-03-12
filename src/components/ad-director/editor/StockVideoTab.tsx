import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Business", "Nature", "Technology", "Food", "Travel", "People", "Abstract", "City"];

export function StockVideoTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Stock Video</h4>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stock videos…"
          className="h-8 text-xs pl-8 bg-muted/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => toast({ title: "Coming soon", description: `${cat} stock videos` })}
            className="aspect-video rounded-lg bg-muted/40 border border-border/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-1"
          >
            <Film className="w-4 h-4 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">{cat}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
