import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Boxes, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDGE_FUNCTIONS, EDGE_FUNCTION_CATEGORIES, type EdgeFunctionInfo } from "@/lib/edgeFunctionsRegistry";
import { getCallersFor } from "@/lib/edgeFunctionConnections";
import { EdgeFunctionDetailDialog } from "./EdgeFunctionDetailDialog";

const accentBorder: Record<EdgeFunctionInfo["accent"], string> = {
  cyan: "border-cyan-400/30 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]",
  emerald: "border-emerald-400/30 hover:border-emerald-400/70 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]",
  orange: "border-orange-400/30 hover:border-orange-400/70 hover:shadow-[0_0_15px_rgba(251,146,60,0.2)]",
  violet: "border-violet-400/30 hover:border-violet-400/70 hover:shadow-[0_0_15px_rgba(167,139,250,0.2)]",
  blue: "border-blue-400/30 hover:border-blue-400/70 hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]",
  rose: "border-rose-400/30 hover:border-rose-400/70 hover:shadow-[0_0_15px_rgba(251,113,133,0.2)]",
  amber: "border-amber-400/30 hover:border-amber-400/70 hover:shadow-[0_0_15px_rgba(245,195,68,0.2)]",
};

const accentText: Record<EdgeFunctionInfo["accent"], string> = {
  cyan: "text-cyan-400",
  emerald: "text-emerald-400",
  orange: "text-orange-400",
  violet: "text-violet-400",
  blue: "text-blue-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
};

const accentDot: Record<EdgeFunctionInfo["accent"], string> = {
  cyan: "bg-cyan-400",
  emerald: "bg-emerald-400",
  orange: "bg-orange-400",
  violet: "bg-violet-400",
  blue: "bg-blue-400",
  rose: "bg-rose-400",
  amber: "bg-amber-400",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EdgeFunctionsPanel({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<EdgeFunctionInfo | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EDGE_FUNCTIONS.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
    });
  }, [query, activeCategory]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of EDGE_FUNCTIONS) {
      map.set(f.category, (map.get(f.category) ?? 0) + 1);
    }
    return map;
  }, []);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-border/80 bg-background/95 p-0 backdrop-blur-xl sm:max-w-none md:w-[960px]"
        >
          <div className="sticky top-0 z-10 border-b border-border/40 bg-background/90 px-6 py-4 backdrop-blur-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-5 w-5 text-cyan-400" />
                Edge Functions Explorer
                <span className="ml-2 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {filtered.length} / {EDGE_FUNCTIONS.length}
                </span>
              </SheetTitle>
              <SheetDescription>
                Browse every deployed Edge Function and inspect its frontend callers, triggers, and related siblings.
              </SheetDescription>
            </SheetHeader>

            {/* Search */}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or category…"
                className="pl-9"
              />
            </div>

            {/* Category chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeCategory === null
                    ? "border-foreground/60 bg-foreground/10 text-foreground"
                    : "border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
                )}
              >
                All ({EDGE_FUNCTIONS.length})
              </button>
              {EDGE_FUNCTION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    activeCategory === cat
                      ? "border-foreground/60 bg-foreground/10 text-foreground"
                      : "border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
                  )}
                >
                  {cat} ({counts.get(cat) ?? 0})
                </button>
              ))}
            </div>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((fn) => {
              const callerCount = getCallersFor(fn.name).length;
              return (
                <button
                  key={fn.name}
                  onClick={() => setSelected(fn)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-lg border bg-card/40 p-3 text-left transition-all",
                    accentBorder[fn.accent],
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", accentDot[fn.accent])} />
                    <code className={cn("flex-1 break-all font-mono text-[12px] font-semibold", accentText[fn.accent])}>
                      {fn.name}
                    </code>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{fn.category}</p>
                  <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {callerCount} caller{callerCount === 1 ? "" : "s"}
                    </span>
                    <span className="flex gap-1">
                      {fn.triggers.map((t) => (
                        <span
                          key={t}
                          className="rounded-sm border border-border/40 bg-muted/30 px-1 py-0.5 text-[9px] capitalize"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                No functions match your filters.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EdgeFunctionDetailDialog
        fn={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onSelect={setSelected}
      />
    </>
  );
}
