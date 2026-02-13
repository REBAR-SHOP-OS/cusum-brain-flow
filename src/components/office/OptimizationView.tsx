import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Zap, Sparkles, ChevronRight, BarChart3, Scissors,
  Weight, TrendingDown, CheckCircle2, Loader2, AlertTriangle, Target,
  Recycle, Trash2,
} from "lucide-react";
import { useExtractSessions, useExtractRows } from "@/hooks/useExtractSessions";
import { runOptimization, type CutItem, type OptimizationSummary, type OptimizerConfig } from "@/lib/cutOptimizer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { cn } from "@/lib/utils";

const STOCK_LENGTHS = [6000, 12000, 18000];

const OptimizationView = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { sessions, loading: sessionsLoading } = useExtractSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { rows, loading: rowsLoading } = useExtractRows(selectedSessionId);
  const [stockLength, setStockLength] = useState(12000);
  const [kerf, setKerf] = useState(5);
  const [minRemnant, setMinRemnant] = useState(300);
  const [selectedPlan, setSelectedPlan] = useState<OptimizerConfig["mode"] | null>(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyId();

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const availableSessions = useMemo(
    () => sessions.filter((s) => ["approved", "validated", "mapping", "extracted"].includes(s.status)),
    [sessions],
  );

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

  const makeConfig = (mode: OptimizerConfig["mode"]): OptimizerConfig => ({
    stockLengthMm: stockLength,
    kerfMm: kerf,
    minRemnantMm: minRemnant,
    mode,
  });

  const standardResult = useMemo<OptimizationSummary | null>(() => {
    if (!cutItems.length) return null;
    return runOptimization(cutItems, makeConfig("standard"));
  }, [cutItems, stockLength, kerf, minRemnant]);

  const optimizedResult = useMemo<OptimizationSummary | null>(() => {
    if (!cutItems.length) return null;
    return runOptimization(cutItems, makeConfig("optimized"));
  }, [cutItems, stockLength, kerf, minRemnant]);

  const bestFitResult = useMemo<OptimizationSummary | null>(() => {
    if (!cutItems.length) return null;
    return runOptimization(cutItems, makeConfig("best-fit"));
  }, [cutItems, stockLength, kerf, minRemnant]);

  const getResult = (mode: OptimizerConfig["mode"] | null) => {
    if (mode === "standard") return standardResult;
    if (mode === "best-fit") return bestFitResult;
    return optimizedResult; // default
  };

  const activeResult = getResult(selectedPlan) || optimizedResult;

  const savings = useMemo(() => {
    if (!standardResult || !optimizedResult) return null;
    const best = bestFitResult && bestFitResult.totalWasteKg < optimizedResult.totalWasteKg ? bestFitResult : optimizedResult;
    return {
      wasteReduction: standardResult.totalWasteKg - best.totalWasteKg,
      barsSaved: standardResult.totalStockBars - best.totalStockBars,
      efficiencyGain: best.overallEfficiency - standardResult.overallEfficiency,
      bestMode: best === bestFitResult ? "Best Fit" : "FFD Optimized",
    };
  }, [standardResult, optimizedResult, bestFitResult]);

  const skippedCount = activeResult?.totalSkipped ?? 0;

  const handleApplyPlan = async () => {
    if (!selectedPlan || !selectedSessionId || !companyId) return;
    setApplying(true);
    try {
      const result = getResult(selectedPlan);
      const { error } = await supabase.from("optimization_snapshots" as any).insert({
        session_id: selectedSessionId,
        company_id: companyId,
        mode: selectedPlan,
        stock_length_mm: stockLength,
        kerf_mm: kerf,
        min_remnant_mm: minRemnant,
        plan_data: result,
        total_stock_bars: result?.totalStockBars,
        total_waste_kg: result?.totalWasteKg,
        efficiency: result?.overallEfficiency,
      } as any);
      if (error) throw error;
      toast({
        title: `${selectedPlan} plan applied`,
        description: `Optimization snapshot saved for ${selectedSession?.name}`,
      });
    } catch (err: any) {
      toast({ title: "Error saving plan", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  // Session selection
  if (!selectedSessionId) {
    return (
      <div ref={ref} className="p-6 space-y-4">
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

  // Empty state
  if (!rowsLoading && cutItems.length === 0) {
    return (
      <div ref={ref} className="p-6 flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No valid cut items found in this session.</p>
        <Button variant="outline" size="sm" onClick={() => { setSelectedSessionId(null); setSelectedPlan(null); }}>
          ← Back
        </Button>
      </div>
    );
  }

  if (rowsLoading || !standardResult || !optimizedResult || !bestFitResult) {
    return (
      <div ref={ref} className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Calculating optimization...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div ref={ref} className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black italic text-foreground uppercase">Optimization</h1>
            <p className="text-xs tracking-widest text-primary/70 uppercase">
              {selectedSession?.name} · {cutItems.length} line items · {rows.reduce((s, r) => s + (r.quantity || 0), 0)} pieces
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase">Kerf:</span>
              <Input
                type="number"
                value={kerf}
                onChange={(e) => setKerf(Math.max(0, Number(e.target.value)))}
                className="w-14 h-8 text-xs"
                min={0}
                max={20}
              />
              <span className="text-[10px] text-muted-foreground">mm</span>
            </div>
          </div>
        </div>

        {/* Skipped Pieces Warning */}
        {skippedCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-foreground">
              <strong>{skippedCount} pieces</strong> exceed {stockLength / 1000}M stock length and were skipped from optimization.
            </p>
          </div>
        )}

        {/* Savings Banner */}
        {savings && savings.wasteReduction > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <TrendingDown className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {savings.bestMode} saves {savings.wasteReduction.toFixed(1)} KG of waste
                {savings.barsSaved > 0 && ` and ${savings.barsSaved} stock bars`}
              </p>
              <p className="text-xs text-muted-foreground">
                +{savings.efficiencyGain.toFixed(1)}% efficiency gain over Standard
              </p>
            </div>
          </div>
        )}

        {/* Three-way Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PlanCard mode="standard" result={standardResult} selected={selectedPlan === "standard"} onSelect={() => setSelectedPlan("standard")} />
          <PlanCard mode="optimized" result={optimizedResult} selected={selectedPlan === "optimized"} onSelect={() => setSelectedPlan("optimized")} />
          <PlanCard mode="best-fit" result={bestFitResult} selected={selectedPlan === "best-fit"} onSelect={() => setSelectedPlan("best-fit")} />
        </div>

        {/* Apply Button */}
        {selectedPlan && (
          <div className="flex items-center gap-3">
            <Button onClick={handleApplyPlan} disabled={applying} className="gap-1.5">
              {applying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Apply {selectedPlan} Plan</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              This will save the optimization snapshot for production.
            </span>
          </div>
        )}

        {/* Per-Size Breakdown */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
            Breakdown by Bar Size
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(activeResult || optimizedResult).results.map((r) => (
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Recycle className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground text-[10px]">Remnants:</span>
                      <span className="font-bold">{r.usableRemnantCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-[10px]">Scrap:</span>
                      <span className="font-bold">{r.scrapCount}</span>
                    </div>
                  </div>
                  {r.skippedPieces.length > 0 && (
                    <div className="text-[10px] text-amber-500">
                      ⚠ {r.skippedPieces.length} oversized pieces skipped
                    </div>
                  )}
                  <Progress value={r.efficiency} className="h-1.5" />

                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {r.bars.slice(0, 8).map((bar, idx) => {
                      const usedPct = ((r.stockLengthMm - bar.remainderMm) / r.stockLengthMm) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground w-4">{idx + 1}</span>
                          <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-sm" style={{ width: `${usedPct}%` }} />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-10 text-right">{bar.remainderMm}mm</span>
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
});
OptimizationView.displayName = "OptimizationView";
export { OptimizationView };

// ─── Plan Card ──────────────────────────────────────────────
const PlanCard = React.forwardRef<HTMLDivElement, {
  mode: OptimizerConfig["mode"];
  result: OptimizationSummary;
  selected: boolean;
  onSelect: () => void;
}>(({ mode, result, selected, onSelect }, ref) => {
  const Icon = mode === "best-fit" ? Target : mode === "optimized" ? Sparkles : Zap;
  const label = mode === "best-fit" ? "Best Fit" : mode === "optimized" ? "Optimized (FFD)" : "Standard";

  return (
    <Card
      ref={ref}
      className={cn(
        "border-2 transition-all cursor-pointer",
        selected
          ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)]"
          : "border-border hover:border-primary/40",
      )}
      onClick={onSelect}
    >
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-primary uppercase">Efficiency</p>
            <p className="text-3xl font-black italic text-primary">{result.overallEfficiency.toFixed(1)}%</p>
          </div>
        </div>

        <h2 className="text-lg font-black text-foreground uppercase">{label}</h2>

        <div className="space-y-2">
          <StatRow icon={Scissors} label="Stopper Moves" value={result.totalStopperMoves} />
          <StatRow icon={BarChart3} label="Stock Bars" value={result.totalStockBars} />
          <StatRow icon={Scissors} label="Total Cuts" value={result.totalCuts} />
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Recycle className="w-3.5 h-3.5" /> Remnants
            </span>
            <span className="text-sm font-bold text-foreground">{result.totalUsableRemnants}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Scrap Bars
            </span>
            <span className="text-sm font-bold text-foreground">{result.totalScrap}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Weight className="w-3.5 h-3.5" /> Net Waste
            </span>
            <span className="text-lg font-bold text-primary">{result.totalWasteKg.toFixed(2)} KG</span>
          </div>
        </div>

        <Button className="w-full" variant={selected ? "default" : "outline"}>
          {selected ? "✓ Selected" : "Select This Plan"}
        </Button>
      </CardContent>
    </Card>
  );
});
PlanCard.displayName = "PlanCard";

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}
