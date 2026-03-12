import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, ImagePlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

const CATEGORIES = ["Backgrounds", "Textures", "Patterns", "Objects", "Landscapes", "Portraits"];

interface PexelsPhoto {
  id: number;
  thumbnail: string;
  url: string;
  photographer: string;
  width: number;
  height: number;
}

export function StockImagesTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await invokeEdgeFunction<{ results: PexelsPhoto[] }>("pexels-search", {
        type: "photo",
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

  const handleSelect = (photo: PexelsPhoto) => {
    navigator.clipboard.writeText(photo.url);
    toast({ title: "Image URL copied", description: `By ${photo.photographer}` });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Stock Images</h4>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search stock images…"
          className="h-8 text-xs pl-8 bg-muted/30"
        />
      </div>

      {results.length === 0 && !loading && (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className="aspect-square rounded-lg bg-muted/40 border border-border/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-1"
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
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
          {results.map(photo => (
            <button
              key={photo.id}
              onClick={() => handleSelect(photo)}
              className="group relative rounded-lg overflow-hidden border border-border/30 hover:border-primary/40 transition-all"
            >
              <img
                src={photo.thumbnail}
                alt={`By ${photo.photographer}`}
                className="w-full aspect-square object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-white truncate block">{photo.photographer}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <p className="text-[8px] text-muted-foreground text-center">Photos provided by Pexels</p>
      )}
    </div>
  );
}
