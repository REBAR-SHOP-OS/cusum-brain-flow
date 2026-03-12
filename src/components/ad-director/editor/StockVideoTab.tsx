import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Film, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

const CATEGORIES = ["Business", "Nature", "Technology", "Food", "Travel", "People", "Abstract", "City"];

interface PexelsVideo {
  id: number;
  thumbnail: string;
  url: string;
  videographer: string;
  duration: number;
  width: number;
  height: number;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function StockVideoTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PexelsVideo[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await invokeEdgeFunction<{ results: PexelsVideo[] }>("pexels-search", {
        type: "video",
        query: q.trim(),
        per_page: 20,
      });
      setResults(data.results || []);
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search(query);
  };

  const handleCategoryClick = (cat: string) => {
    setQuery(cat);
    search(cat);
  };

  const handleSelect = (video: PexelsVideo) => {
    navigator.clipboard.writeText(video.url);
    toast({ title: "Video URL copied", description: `By ${video.videographer}` });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Stock Video</h4>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search stock videos…"
          className="h-8 text-xs pl-8 bg-muted/30"
        />
      </div>

      {results.length === 0 && !loading && (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className="aspect-video rounded-lg bg-muted/40 border border-border/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-1"
            >
              <Film className="w-4 h-4 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">{cat}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
          {results.map(video => (
            <button
              key={video.id}
              onClick={() => handleSelect(video)}
              className="group relative rounded-lg overflow-hidden border border-border/30 hover:border-primary/40 transition-all"
            >
              <img
                src={video.thumbnail}
                alt={`By ${video.videographer}`}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
              <div className="absolute top-1 right-1 bg-black/70 rounded px-1 py-0.5">
                <span className="text-[9px] text-white font-mono">{formatDuration(video.duration)}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-white truncate block">{video.videographer}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <p className="text-[8px] text-muted-foreground text-center">Videos provided by Pexels</p>
      )}
    </div>
  );
}
