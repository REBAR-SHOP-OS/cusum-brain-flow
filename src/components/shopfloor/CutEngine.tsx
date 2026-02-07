import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Lock, Zap, AlertCircle, Scissors, Package, Recycle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunPlan } from "@/lib/foremanBrain";

interface CutEngineProps {
  barCode: string;
  maxBars?: number;
  suggestedBars?: number;
  runPlan?: RunPlan | null;
  onLockAndStart: (stockLength: number, bars: number) => void;
  onStockLengthChange?: (length: number) => void;
  isRunning: boolean;
  canWrite: boolean;
  darkMode?: boolean;
}

const STOCK_LENGTHS = [6000, 12000, 18000];

export function CutEngine({
  barCode,
  maxBars = 10,
  suggestedBars,
  runPlan,
  onLockAndStart,
  onStockLengthChange,
  isRunning,
  canWrite,
  darkMode = false,
}: CutEngineProps) {
  const [selectedStock, setSelectedStock] = useState(12000);
  const [bars, setBars] = useState(suggestedBars || 1);

  // Sync bars from run plan or suggested
  useEffect(() => {
    if (runPlan?.feasible) {
      setBars(runPlan.barsThisRun);
    } else if (suggestedBars && suggestedBars > 0) {
      setBars(Math.min(suggestedBars, maxBars));
    }
  }, [runPlan?.barsThisRun, runPlan?.feasible, suggestedBars, maxBars]);

  const handleStockChange = (len: number) => {
    setSelectedStock(len);
    onStockLengthChange?.(len);
  };

  const baseClasses = darkMode ? "text-white" : "text-foreground";
  const mutedClasses = darkMode ? "text-slate-400" : "text-muted-foreground";
  const borderClasses = darkMode ? "border-slate-700" : "border-border";
  const cardBg = darkMode ? "bg-slate-800" : "bg-muted";

  // Run plan metrics
  const piecesPerBar = runPlan?.piecesPerBar || 0;
  const lastBarPieces = runPlan?.lastBarPieces || 0;
  const remnantMm = runPlan?.remnantPerFullBar || 0;
  const lastRemnantMm = runPlan?.lastBarRemnant || 0;
  const expectedRemnants = runPlan?.expectedRemnantBars || 0;
  const expectedScrap = runPlan?.expectedScrapBars || 0;
  const isFeasible = runPlan?.feasible ?? true;

  // Allow LOCK & START if plan is feasible OR supervisor can confirm
  const canStart = canWrite && !isRunning && (isFeasible || runPlan?.stockSource === "manual");

  return (
    <div className={cn("space-y-4", baseClasses)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold tracking-wider uppercase">Cut Engine</h3>
      </div>

      {/* Bar code display */}
      <div className={cn("text-center py-2 rounded-lg border", borderClasses, cardBg)}>
        <p className={cn("text-[10px] tracking-wider uppercase", mutedClasses)}>Bar Size</p>
        <p className="text-lg font-black font-mono">{barCode}</p>
      </div>

      {/* Stock length selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-primary" />
          <p className={cn("text-xs tracking-wider uppercase font-medium", mutedClasses)}>
            Stock Length
          </p>
        </div>
        <div className={cn("flex rounded-lg overflow-hidden border", borderClasses)}>
          {STOCK_LENGTHS.map((len) => (
            <button
              key={len}
              onClick={() => handleStockChange(len)}
              className={cn(
                "flex-1 py-2.5 text-xs font-mono font-semibold transition-colors",
                selectedStock === len
                  ? "bg-primary text-primary-foreground"
                  : darkMode
                    ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {len / 1000}M
            </button>
          ))}
        </div>
      </div>

      {/* ── RUN PLAN METRICS ── */}
      {runPlan && piecesPerBar > 0 && (
        <div className={cn("rounded-lg border p-3 space-y-2", borderClasses, cardBg)}>
          <p className={cn("text-[10px] tracking-wider uppercase font-bold", mutedClasses)}>
            Run Plan
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-primary shrink-0" />
              <div>
                <p className="text-lg font-black font-mono leading-none">{piecesPerBar}</p>
                <p className={cn("text-[9px] tracking-wider uppercase", mutedClasses)}>pcs/bar</p>
              </div>
            </div>
            {lastBarPieces > 0 && (
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-accent-foreground shrink-0" />
                <div>
                  <p className="text-lg font-black font-mono leading-none">{lastBarPieces}</p>
                  <p className={cn("text-[9px] tracking-wider uppercase", mutedClasses)}>last bar</p>
                </div>
              </div>
            )}
            {expectedRemnants > 0 && (
              <div className="flex items-center gap-2">
                <Recycle className="w-3.5 h-3.5 text-primary shrink-0" />
                <div>
                  <p className="text-lg font-black font-mono leading-none">{expectedRemnants}</p>
                  <p className={cn("text-[9px] tracking-wider uppercase", mutedClasses)}>
                    remnant{expectedRemnants > 1 ? "s" : ""} ({remnantMm}mm)
                  </p>
                </div>
              </div>
            )}
            {expectedScrap > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <div>
                  <p className="text-lg font-black font-mono leading-none">{expectedScrap}</p>
                  <p className={cn("text-[9px] tracking-wider uppercase", mutedClasses)}>scrap</p>
                </div>
              </div>
            )}
          </div>

          {/* Adjusted plan badge */}
          {runPlan.isAdjusted && (
            <Badge
              variant="outline"
              className={cn(
                "w-full justify-center text-[10px] py-1",
                darkMode
                  ? "border-slate-600 text-slate-300"
                  : "border-accent text-accent-foreground"
              )}
            >
              ⚡ Adjusted: {runPlan.adjustmentReason}
            </Badge>
          )}
        </div>
      )}

      {/* Bars counter */}
      <div className="space-y-2">
        <p className={cn("text-xs tracking-wider uppercase font-medium", mutedClasses)}>
          Bars to Load
        </p>
        <div
          className={cn(
            "flex items-center justify-between rounded-lg p-3",
            darkMode ? "bg-slate-800 border border-slate-700" : "bg-muted border border-border"
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-md",
              darkMode && "border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
            )}
            onClick={() => setBars(Math.max(1, bars - 1))}
            disabled={bars <= 1}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <span className="text-3xl font-black font-mono">{bars}</span>
            <span className={cn("text-xs ml-1.5 uppercase tracking-wider", mutedClasses)}>
              Bars
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-md",
              darkMode && "border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
            )}
            onClick={() => setBars(Math.min(maxBars, bars + 1))}
            disabled={bars >= maxBars}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
        <p className={cn("text-[10px] text-center", mutedClasses)}>
          {runPlan?.totalBarsNeeded
            ? `Need ${runPlan.totalBarsNeeded} total · Max capacity: ${maxBars}`
            : `Max capacity: ${maxBars} bars`}
        </p>
      </div>

      {/* Lock & Start button */}
      <Button
        className={cn(
          "w-full gap-2 font-bold h-12 rounded-lg",
          darkMode
            ? "bg-white text-slate-900 hover:bg-slate-100"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        size="lg"
        disabled={!canStart}
        onClick={() => onLockAndStart(selectedStock, bars)}
      >
        <Lock className="w-4 h-4" />
        {isRunning ? "RUNNING..." : "LOCK & START"}
      </Button>

      {isRunning && (
        <Badge
          className={cn(
            "w-full justify-center py-1.5",
            darkMode
              ? "bg-primary/20 text-primary border-primary/30"
              : "bg-primary/20 text-primary border-primary/30"
          )}
        >
          Machine Active
        </Badge>
      )}
    </div>
  );
}
