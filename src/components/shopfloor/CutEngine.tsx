import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Lock } from "lucide-react";

interface CutEngineProps {
  barCode: string;
  maxBars?: number;
  onLockAndStart: (stockLength: number, bars: number) => void;
  isRunning: boolean;
  canWrite: boolean;
}

const STOCK_LENGTHS = [6000, 12000, 18000];

export function CutEngine({ barCode, maxBars = 10, onLockAndStart, isRunning, canWrite }: CutEngineProps) {
  const [selectedStock, setSelectedStock] = useState(12000);
  const [bars, setBars] = useState(1);

  return (
    <Card className="bg-muted/50 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          CUT ENGINE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stock length selector */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tracking-wider uppercase">
            Load Selection
          </p>
          <div className="flex rounded-md overflow-hidden border border-border">
            {STOCK_LENGTHS.map((len) => (
              <button
                key={len}
                onClick={() => setSelectedStock(len)}
                className={`flex-1 py-2 text-xs font-mono font-semibold transition-colors ${
                  selectedStock === len
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {len.toLocaleString()}mm
              </button>
            ))}
          </div>
        </div>

        {/* Bars counter */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tracking-wider uppercase">
            Bars
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setBars(Math.max(1, bars - 1))}
              disabled={bars <= 1}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold font-mono">{bars}</span>
              <span className="text-xs text-muted-foreground ml-1">BARS</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setBars(Math.min(maxBars, bars + 1))}
              disabled={bars >= maxBars}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Bar: {barCode}</span>
            <span>Max: {maxBars}</span>
          </div>
        </div>

        {/* Lock & Start */}
        <Button
          className="w-full gap-2 font-semibold"
          size="lg"
          disabled={!canWrite || isRunning}
          onClick={() => onLockAndStart(selectedStock, bars)}
        >
          <Lock className="w-4 h-4" />
          {isRunning ? "RUNNING..." : "LOCK & START"}
        </Button>

        {isRunning && (
          <Badge className="w-full justify-center bg-success/20 text-success border-success/30">
            Machine Active
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
