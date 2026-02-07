import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Lock, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CutEngineProps {
  barCode: string;
  maxBars?: number;
  suggestedBars?: number;
  onLockAndStart: (stockLength: number, bars: number) => void;
  isRunning: boolean;
  canWrite: boolean;
  darkMode?: boolean;
}

const STOCK_LENGTHS = [6000, 12000, 18000];

export function CutEngine({ 
  barCode, 
  maxBars = 10, 
  suggestedBars,
  onLockAndStart, 
  isRunning, 
  canWrite,
  darkMode = false 
}: CutEngineProps) {
  const [selectedStock, setSelectedStock] = useState(12000);
  const [bars, setBars] = useState(suggestedBars || 1);

  // Update bars when suggested value changes (new item selected)
  useEffect(() => {
    if (suggestedBars && suggestedBars > 0) {
      setBars(Math.min(suggestedBars, maxBars));
    }
  }, [suggestedBars, maxBars]);

  const baseClasses = darkMode 
    ? "text-white" 
    : "text-foreground";

  const mutedClasses = darkMode 
    ? "text-slate-400" 
    : "text-muted-foreground";

  const borderClasses = darkMode
    ? "border-slate-700"
    : "border-border";

  return (
    <div className={cn("space-y-5", baseClasses)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold tracking-wider uppercase">
          Cut Engine
        </h3>
      </div>

      {/* Bar code display */}
      <div className={cn("text-center py-2 rounded-lg border", borderClasses, darkMode ? "bg-slate-800" : "bg-muted")}>
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
              onClick={() => setSelectedStock(len)}
              className={cn(
                "flex-1 py-2.5 text-xs font-mono font-semibold transition-colors",
                selectedStock === len
                  ? "bg-primary text-primary-foreground"
                  : darkMode 
                    ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {(len / 1000)}M
            </button>
          ))}
        </div>
      </div>

      {/* Bars counter */}
      <div className="space-y-2">
        <p className={cn("text-xs tracking-wider uppercase font-medium", mutedClasses)}>
          Bars to Load
        </p>
        <div className={cn(
          "flex items-center justify-between rounded-lg p-3",
          darkMode ? "bg-slate-800 border border-slate-700" : "bg-muted border border-border"
        )}>
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
          Max capacity: {maxBars} bars
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
        disabled={!canWrite || isRunning}
        onClick={() => onLockAndStart(selectedStock, bars)}
      >
        <Lock className="w-4 h-4" />
        {isRunning ? "RUNNING..." : "LOCK & START"}
      </Button>

      {isRunning && (
        <Badge className={cn(
          "w-full justify-center py-1.5",
          darkMode 
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-success/20 text-success border-success/30"
        )}>
          Machine Active
        </Badge>
      )}
    </div>
  );
}
