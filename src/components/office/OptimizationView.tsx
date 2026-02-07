import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Zap, Sparkles, ChevronRight, BarChart3, Scissors,
  Weight, TrendingDown, ArrowRight, CheckCircle2, Loader2,
} from "lucide-react";
import { useExtractSessions, useExtractRows } from "@/hooks/useExtractSessions";
import { runOptimization, type CutItem, type OptimizationSummary } from "@/lib/cutOptimizer";
import { useToast } from "@/hooks/use-toast";

const STOCK_LENGTHS = [6000, 12000, 18000];

export function OptimizationView() {
  const { sessions, loading: sessionsLoading } = useExtractSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { rows, loading: rowsLoading } = useExtractRows(selectedSessionId);
  const [stockLength, setStockLength] = useState(12000);
  const [selectedPlan, setSelectedPlan] = useState<"standard" | "optimized" | null>(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const availableSessions = useMemo(
    () => sessions.filter((s) => ["approved", "validated", "mapping", "extracted"].includes(s.status)),
    [sessions],
  );

  // Convert extract_rows to CutItems
  const cutItems: CutItem[] = useMemo(() => {
    return rows
      .filter((r) => r.total_length_mm && r.total_length_mm > 0 && r.quantity && r.quantity > 0)
      .map((r) => ({
        id: r.id,
        mark: r.mark || `R${r.row_index}`,
        barSize: (r.bar_size_mapped || r.bar_size || "10M").toUpperCase(),
        lengthMm: r.total_length_mm!,
        quantity: r.quantity!,
        shapeType: r.shape_code_mapped || r.shape_type || undefined,
      }));
  }, [rows]);

  // Run both optimization strategies
  const standardResult = useMemo<OptimizationSummary | null>(() => {
    if (!cutItems.length) return null;
    return runOptimization(cutItems, stockLength, "standard");
  }, [cutItems, stockLength]);

  const optimizedResult = useMemo<OptimizationSummary | null>(() => {
    if (!cutItems.length) return null;
    return runOptimization(cutItems, stockLength, "optimized");
  }, [cutItems, stockLength]);

  const savings = useMemo(() => {
    if (!standardResult || !optimizedResult) return null;
    return {
      wasteReduction: standardResult.totalWasteKg - optimizedResult.totalWasteKg,
      barsSaved: standardResult.totalStockBars - optimizedResult.totalStockBars,
      efficiencyGain: optimizedResult.overallEfficiency - standardResult.overallEfficiency,
    };
  }, [standardResult, optimizedResult]);

  const handleApplyPlan = async () => {
    if (!selectedPlan || !selectedSessionId) return;
    setApplying(true);
    // Simulate applying — in production this would create/update cut_plans
    await new Promise((resolve) => setTimeout(resolve, 1200));
    toast({
      title: `${selectedPlan === "optimized" ? "Optimized" : "Standard"} plan applied`,
      description: `Cut plan queued for ${selectedSession?.name}`,
    });
    setApplying(false);
  };

  // Session selection
  if (!selectedSessionId) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase">Optimization</h1>
          <p className="text-xs tracking-widest text-primary/70 uppercase">Cross-Strategy Logic Comparison</p>
        </div>
        <p className="text-sm text-muted-foreground">Select a manifest session to optimize cutting.</p>
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : availableSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions with extracted data found.</p>
        ) : (
          <div className="space-y-2">
            {availableSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div>
                  <span className="font-bold text-foreground">{s.name}</span>
                  {s.customer && <span className="ml-3 text-xs text-muted-foreground">{s.customer}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] tracking-wider border-0 bg-primary/20 text-primary">
                    {s.status.toUpperCase()}
                  </Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (rowsLoading || !standardResult || !optimizedResult) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Calculating optimization...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black italic text-foreground uppercase">Supervisor Hub</h1>
            <p className="text-xs tracking-widest text-primary/70 uppercase">
              {selectedSession?.name} · {cutItems.length} line items · {rows.reduce((s, r) => s + (r.quantity || 0), 0)} pieces
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedSessionId(null); setSelectedPlan(null); }}>
              ← Back
            </Button>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Stock:</span>
            {STOCK_LENGTHS.map((len) => (
              <Button
                key={len}
                variant={stockLength === len ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setStockLength(len)}
              >
                {len / 1000}M
              </Button>
            ))}
          </div>
        </div>

        {/* Savings Banner */}
        {savings && savings.wasteReduction > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <TrendingDown className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                Optimization saves {savings.wasteReduction.toFixed(1)} KG of waste
                {savings.barsSaved > 0 && ` and ${savings.barsSaved} stock bars`}
              </p>
              <p className="text-xs text-muted-foreground">
                +{savings.efficiencyGain.toFixed(1)}% efficiency gain
              </p>
            </div>
          </div>
        )}

        {/* Side-by-side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlanCard
            mode="standard"
            result={standardResult}
            selected={selectedPlan === "standard"}
            onSelect={() => setSelectedPlan("standard")}
          />
          <PlanCard
            mode="optimized"
            result={optimizedResult}
            selected={selectedPlan === "optimized"}
            onSelect={() => setSelectedPlan("optimized")}
          />
        </div>

        {/* Apply Button */}
        {selectedPlan && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleApplyPlan}
              disabled={applying}
              className="gap-1.5"
            >
              {applying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Apply {selectedPlan === "optimized" ? "Optimized" : "Standard"} Plan</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              This will create a cut plan and queue it for production.
            </span>
          </div>
        )}

        {/* Per-Size Breakdown */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
            Breakdown by Bar Size
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(selectedPlan === "optimized" ? optimizedResult : standardResult).results.map((r) => (
              <Card key={r.barSize} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs font-bold">{r.barSize}</Badge>
                    <span className="text-lg font-black text-primary">{r.efficiency.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Bars</span>
                      <span className="font-bold">{r.totalStockBars}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Cuts</span>
                      <span className="font-bold">{r.totalCuts}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Waste</span>
                      <span className="font-bold">{r.wasteKg.toFixed(1)} kg</span>
                    </div>
                  </div>
                  <Progress value={r.efficiency} className="h-1.5" />

                  {/* Visual bar representation */}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {r.bars.slice(0, 8).map((bar, idx) => {
                      const usedPct = ((r.stockLengthMm - bar.remainderMm) / r.stockLengthMm) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground w-4">{idx + 1}</span>
                          <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-sm"
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-10 text-right">
                            {bar.remainderMm}mm
                          </span>
                        </div>
                      );
                    })}
                    {r.bars.length > 8 && (
                      <span className="text-[9px] text-muted-foreground">+{r.bars.length - 8} more bars</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Plan Card ──────────────────────────────────────────────
function PlanCard({
  mode,
  result,
  selected,
  onSelect,
}: {
  mode: "standard" | "optimized";
  result: OptimizationSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const isOptimized = mode === "optimized";
  const Icon = isOptimized ? Sparkles : Zap;

  return (
    <Card
      className={`border-2 transition-all cursor-pointer ${
        selected
          ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)]"
          : "border-border hover:border-primary/40"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-primary uppercase">Efficiency</p>
            <p className="text-3xl font-black italic text-primary">{result.overallEfficiency.toFixed(1)}%</p>
          </div>
        </div>

        <h2 className="text-xl font-black text-foreground uppercase">
          {isOptimized ? "Optimized" : "Standard"}
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" /> Stopper Moves
            </span>
            <span className="text-xl font-bold text-foreground">{result.totalStopperMoves}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Stock Bars
            </span>
            <span className="text-xl font-bold text-foreground">{result.totalStockBars}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" /> Total Cuts
            </span>
            <span className="text-xl font-bold text-foreground">{result.totalCuts}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Weight className="w-3.5 h-3.5" /> Net Waste
            </span>
            <span className="text-xl font-bold text-primary">{result.totalWasteKg.toFixed(2)} KG</span>
          </div>
        </div>

        <Button className="w-full" variant={selected ? "default" : "outline"}>
          {selected ? "✓ Selected" : "Select This Plan"}
        </Button>
      </CardContent>
    </Card>
  );
}
