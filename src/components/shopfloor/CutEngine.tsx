import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Lock, Zap, AlertCircle, Scissors, Package, Recycle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunPlan } from "@/lib/foremanBrain";

interface CutEngineProps {
  barCode: string;
  maxBars?: number;
  suggestedBars?: number;
  runPlan?: RunPlan | null;
  onLockAndStart: (stockLength: number, bars: number) => void;
  onStockLengthChange?: (length: number) => void;
  onBarsChange?: (bars: number) => void;
  onAbort?: () => void;
  onStopRun?: () => void;
  isRunning: boolean;
  canWrite: boolean;
  darkMode?: boolean;
  /** Supervisors can exceed maxBars with a warning */
  isSupervisor?: boolean;
  /** Authoritative bar count locked at run start (from SlotTracker) */
  lockedBars?: number;
  /** Live counter data from slot tracker */
  strokesDone?: number;
  totalStrokesNeeded?: number;
  totalPiecesDone?: number;
  totalPiecesPlanned?: number;
  activeBars?: number;
  isDone?: boolean;
}

const STOCK_LENGTHS = [6000, 12000, 18000];

export function CutEngine({
  barCode,
  maxBars = 10,
  suggestedBars,
  runPlan,
  onLockAndStart,
  onStockLengthChange,
  onBarsChange,
  onAbort,
  onStopRun,
  isRunning,
  canWrite,
  darkMode = false,
  isSupervisor = false,
  lockedBars,
  strokesDone = 0,
  totalStrokesNeeded = 0,
  totalPiecesDone = 0,
  totalPiecesPlanned = 0,
  activeBars = 0,
  isDone = false,
}: CutEngineProps) {
  const [selectedStock, setSelectedStock] = useState(12000);
  const [bars, setBars] = useState(suggestedBars || 1);
  const [operatorOverride, setOperatorOverride] = useState(false);
  const barsLocked = useRef(false);

  // Sync bars from run plan or suggested — but NEVER override operator's manual choice,
  // NEVER change bars while a run is active, and NEVER change after first lock
  useEffect(() => {
    if (isRunning || operatorOverride || barsLocked.current) return;
    if (runPlan?.feasible) {
      setBars(Math.min(runPlan.barsThisRun, maxBars));
      barsLocked.current = true;
    } else if (suggestedBars && suggestedBars > 0) {
      setBars(Math.min(suggestedBars, maxBars));
      barsLocked.current = true;
    }
  }, [runPlan?.barsThisRun, runPlan?.feasible, suggestedBars, maxBars, isRunning, operatorOverride]);

  // Reset override flag and bars lock when item changes (new barCode) or run completes
  useEffect(() => {
    if (!isRunning) {
      setOperatorOverride(false);
      barsLocked.current = false;
    }
  }, [barCode, isRunning]);

  // Sync internal bars state to lockedBars when a run starts,
  // so supervisor edits start from the actual loaded value
  useEffect(() => {
    if (isRunning && lockedBars != null && !operatorOverride) {
      setBars(lockedBars);
    }
  }, [isRunning, lockedBars]);

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

  const isOverCapacity = bars > maxBars;

  // Allow LOCK & START if plan is feasible OR supervisor can confirm
  // Supervisors can start above capacity; operators cannot
  const canStart = canWrite && !isRunning && !isDone && !isOverCapacity && (isFeasible || runPlan?.stockSource === "manual");

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
        <p className="text-lg font-black font-mono">{barCode || "—"}</p>
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
          {isSupervisor ? (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-md",
                darkMode && "border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
              )}
              onClick={() => { const n = Math.max(1, bars - 1); setBars(n); setOperatorOverride(true); onBarsChange?.(n); }}
              disabled={bars <= 1 || (isRunning && !isSupervisor)}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          ) : (
            <div className="h-9 w-9" />
          )}
          <div className="text-center">
            <span className={cn("text-3xl font-black font-mono", isOverCapacity && "text-amber-400")}>{isRunning && lockedBars != null && !isSupervisor ? lockedBars : bars}</span>
            <span className={cn("text-xs ml-1.5 uppercase tracking-wider", mutedClasses)}>
              Bars
            </span>
          </div>
          {isSupervisor ? (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-md",
                darkMode && "border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
              )}
              onClick={() => { const n = Math.min(maxBars, bars + 1); setBars(n); setOperatorOverride(true); onBarsChange?.(n); }}
              disabled={bars >= maxBars || (isRunning && !isSupervisor)}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          ) : (
            <div className="h-9 w-9" />
          )}
        </div>
        <p className={cn("text-[10px] text-center", mutedClasses)}>
          {runPlan?.totalBarsNeeded
            ? `Need ${runPlan.totalBarsNeeded} total · Max capacity: ${maxBars}`
            : `Max capacity: ${maxBars} bars`}
        </p>
        {/* Role-based helper text */}
        <p className={cn("text-[10px] text-center font-medium",
          operatorOverride && isSupervisor ? "text-amber-400"
          : bars >= maxBars && isSupervisor ? "text-amber-400"
          : mutedClasses
        )}>
          {bars >= maxBars && isSupervisor
            ? `⚠ Capped at machine max capacity: ${maxBars}`
            : operatorOverride && isSupervisor
              ? "⚡ Supervisor override active"
              : isSupervisor
                ? "Supervisor can override within machine limit"
                : "Auto-set to max safe load"}
        </p>
      </div>

      {/* Lock & Start / Abort buttons */}
      {isRunning && strokesDone === 0 && onAbort ? (
        <Button
          className={cn(
            "w-full gap-2 font-bold h-12 rounded-lg",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          )}
          size="lg"
          onClick={onAbort}
        >
          <XCircle className="w-4 h-4" />
          ABORT — FIX SETTINGS
        </Button>
      ) : (
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
          {isRunning ? "RUNNING..." : isDone ? "✓ DONE" : "LOCK & START"}
        </Button>
      )}

      {isRunning && strokesDone !== 0 && (
        <div className="flex gap-2 w-full">
          <Badge
            className={cn(
              "flex-1 justify-center py-1.5",
              "bg-primary/20 text-primary border-primary/30"
            )}
          >
            Machine Active
          </Badge>
          {onStopRun && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 font-bold"
              onClick={onStopRun}
            >
              <XCircle className="w-4 h-4" />
              Stop Run
            </Button>
          )}
        </div>
      )}

      {/* ── LIVE COUNTER (visible during run) ── */}
      {isRunning && totalPiecesPlanned > 0 && (
        <div className={cn("rounded-lg border p-4 space-y-3", borderClasses, cardBg)}>
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-primary" />
            <p className={cn("text-[10px] tracking-wider uppercase font-bold", mutedClasses)}>
              Live Counter
            </p>
          </div>

          {/* Strokes */}
          <div className="text-center">
            <p className={cn("text-[9px] tracking-wider uppercase mb-1", mutedClasses)}>Strokes</p>
            <p className="text-4xl font-black font-mono leading-none">
              {strokesDone}
              <span className={cn("text-lg", mutedClasses)}>/{totalStrokesNeeded}</span>
            </p>
          </div>

          {/* Pieces this run */}
          <div className="text-center">
            <p className={cn("text-[9px] tracking-wider uppercase mb-1", mutedClasses)}>Pieces This Run</p>
            <p className="text-4xl font-black font-mono leading-none text-primary">
              {totalPiecesDone}
              <span className={cn("text-lg", mutedClasses)}>/{totalPiecesPlanned}</span>
            </p>
          </div>

          {/* Per stroke info */}
          {activeBars > 0 && (
            <p className={cn("text-[10px] text-center", mutedClasses)}>
              Each stroke = {activeBars} piece{activeBars > 1 ? "s" : ""} ({activeBars} bar{activeBars > 1 ? "s" : ""})
            </p>
          )}

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${totalPiecesPlanned > 0 ? (totalPiecesDone / totalPiecesPlanned) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
