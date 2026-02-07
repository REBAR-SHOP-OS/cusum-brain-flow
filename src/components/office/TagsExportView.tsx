import { useState } from "react";
import { useCutPlans, useCutPlanItems } from "@/hooks/useCutPlans";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Table as TableIcon, Download, Printer, Zap, Sparkles } from "lucide-react";

export function TagsExportView() {
  const { plans, loading: plansLoading } = useCutPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { items, loading: itemsLoading } = useCutPlanItems(selectedPlanId);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortMode, setSortMode] = useState<"standard" | "optimized">("standard");

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"];

  if (!selectedPlanId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-black italic text-foreground uppercase">Tags & Export</h1>
        <p className="text-sm text-muted-foreground">Select a manifest to view tags and export data.</p>
        {plansLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="font-bold text-foreground">{plan.name}</span>
                <span className="ml-3 text-xs text-muted-foreground">{plan.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{selectedPlan?.name}</h2>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Tags & Dispatch Tooling</p>
            </div>
          </div>

          {/* Sort mode toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={sortMode === "standard" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSortMode("standard")}
            >
              <Zap className="w-3 h-3" /> Standard
            </Button>
            <Button
              variant={sortMode === "optimized" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSortMode("optimized")}
            >
              <Sparkles className="w-3 h-3" /> Optimized
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="w-3 h-3" /> Table
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="w-3 h-3" /> Cards
            </Button>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8">
            <Printer className="w-3.5 h-3.5" /> Print Tags
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-[1200px]">
          <div className="grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_60px_80px_80px] gap-0 px-4 py-2 bg-primary/10 border-b border-border text-[10px] font-bold tracking-widest text-primary uppercase sticky top-0">
            <span>DWG #</span>
            <span>Item</span>
            <span>Grade</span>
            <span>Mark</span>
            <span>Qty</span>
            <span>Size</span>
            <span>Type</span>
            <span className="text-primary">Total Length</span>
            {dimCols.map(c => <span key={c}>{c}</span>)}
            <span>Weight (KG)</span>
            <span>Picture</span>
            <span>Customer</span>
          </div>

          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No items.</div>
          ) : (
            items.map((item, idx) => {
              const dims = item.bend_dimensions || {};
              // Rough weight calc
              const weightKg = ((item.cut_length_mm / 1000) * (parseInt(item.bar_code) === 10 ? 0.617 : parseInt(item.bar_code) === 15 ? 1.387 : 2.466) * item.total_pieces).toFixed(2);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_60px_80px_80px] gap-0 px-4 py-2.5 border-b border-border/50 hover:bg-muted/30 text-sm items-center"
                >
                  <span className="text-xs text-muted-foreground">{item.drawing_ref || "—"}</span>
                  <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  <span className="text-xs text-muted-foreground">400W</span>
                  <span className="text-xs font-bold">{item.mark_number || "—"}</span>
                  <span className="text-xs">{item.total_pieces}</span>
                  <span className="text-xs">{item.bar_code}</span>
                  <span className="text-xs">{item.asa_shape_code || "—"}</span>
                  <span className="text-xs font-bold text-primary">{item.cut_length_mm} <sub className="text-[8px] text-primary/60">MM</sub></span>
                  {dimCols.map(c => (
                    <span key={c} className="text-xs text-muted-foreground">
                      {dims[c] ? <>{dims[c]}<sub className="text-[8px] ml-0.5">MM</sub></> : ""}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground">{weightKg}</span>
                  <span className="text-[10px] text-muted-foreground/50 tracking-widest uppercase">TYPE 01/MK</span>
                  <span className="text-xs text-muted-foreground">—</span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
