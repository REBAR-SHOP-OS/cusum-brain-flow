import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Scissors,
  Trash2,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Layers,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
export type SlotStatus = "waiting" | "active" | "removable" | "removed" | "completed";

export interface ActiveSlot {
  index: number;
  plannedCuts: number;
  cutsDone: number;
  status: SlotStatus;
  isPartial: boolean;
}

interface SlotTrackerProps {
  slots: ActiveSlot[];
  barCode: string;
  cutLengthMm: number;
  stockLengthMm: number;
  onRecordStroke: () => void;
  onRemoveBar: (slotIndex: number) => void;
  onCompleteRun: () => void;
  canWrite: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function computeLeftover(stockMm: number, cutsMade: number, cutLenMm: number): number {
  return stockMm - cutsMade * cutLenMm;
}

const REMNANT_THRESHOLD_MM = 300;

// ── Component ────────────────────────────────────────────────────────

export function SlotTracker({
  slots,
  barCode,
  cutLengthMm,
  stockLengthMm,
  onRecordStroke,
  onRemoveBar,
  onCompleteRun,
  canWrite,
}: SlotTrackerProps) {
  const activeSlots = slots.filter((s) => s.status === "active");
  const removableSlots = slots.filter((s) => s.status === "removable");
  const completedSlots = slots.filter((s) => s.status === "completed" || s.status === "removed");
  const allDone = slots.length > 0 && slots.every(
    (s) => s.status === "completed" || s.status === "removed"
  );
  const totalCutsDone = slots.reduce((s, sl) => s + sl.cutsDone, 0);
  const totalPlanned = slots.reduce((s, sl) => s + sl.plannedCuts, 0);

  // Stroke tracking: all active bars share the same stroke count
  const strokesDone = slots.length > 0 ? slots[0].cutsDone : 0;
  const maxStrokes = slots.length > 0 ? Math.max(...slots.map(s => s.plannedCuts)) : 0;
  const nextStroke = activeSlots.length > 0 ? activeSlots[0].cutsDone + 1 : 0;

  // Pieces per stroke = number of bars being cut simultaneously
  const piecesPerStroke = activeSlots.length;
  const totalBars = slots.length;

  // Progress
  const progressPct = totalPlanned > 0 ? (totalCutsDone / totalPlanned) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-wider uppercase text-primary">
            Active Run — Slot Tracker
          </h4>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {totalCutsDone}/{totalPlanned} pcs
        </Badge>
      </div>

      {/* ── CONSOLIDATED RUN SUMMARY ── */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4 space-y-4">
          {/* Big numbers row */}
          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Bars loaded */}
            <div>
              <Layers className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-3xl font-black font-mono leading-none">{totalBars}</p>
              <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-1">
                Bars Loaded
              </p>
            </div>

            {/* Strokes */}
            <div>
              <Scissors className="w-5 h-5 text-primary mx-auto mb-1 animate-pulse" />
              <p className="text-3xl font-black font-mono leading-none">
                {strokesDone}<span className="text-lg text-muted-foreground">/{maxStrokes}</span>
              </p>
              <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-1">
                Strokes
              </p>
            </div>

            {/* Pieces done */}
            <div>
              <CheckCircle2 className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-3xl font-black font-mono leading-none text-primary">
                {totalCutsDone}<span className="text-lg text-muted-foreground">/{totalPlanned}</span>
              </p>
              <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-1">
                Pieces Done
              </p>
            </div>
          </div>

          {/* Per-stroke info */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Each stroke = <span className="font-bold text-primary">{piecesPerStroke} pieces</span>
              {" "}({piecesPerStroke} bar{piecesPerStroke > 1 ? "s" : ""} × 1 cut)
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>

          {/* Status breakdown */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            {activeSlots.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {activeSlots.length} active
              </span>
            )}
            {removableSlots.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent" />
                {removableSlots.length} removable
              </span>
            )}
            {completedSlots.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/40" />
                {completedSlots.length} done
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── REMOVABLE BARS (only show individual cards when action needed) ── */}
      {removableSlots.map((slot) => {
        const leftover = computeLeftover(stockLengthMm, slot.cutsDone, cutLengthMm);
        const isRemnant = leftover >= REMNANT_THRESHOLD_MM;

        return (
          <Card key={slot.index} className="border-accent bg-accent/20">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-accent-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold font-mono">Bar {slot.index + 1}</p>
                <p className="text-xs text-accent-foreground">
                  {slot.cutsDone}/{slot.plannedCuts} cuts done — 
                  {isRemnant ? ` Remnant: ${leftover}mm` : ` Scrap: ${leftover}mm`}
                </p>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-xs border-accent text-accent-foreground hover:bg-accent/30"
                  onClick={() => onRemoveBar(slot.index)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Bar
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Action buttons ── */}
      <div className="flex gap-2">
        {/* Record stroke */}
        {activeSlots.length > 0 && canWrite && (
          <Button
            className="flex-1 gap-2 font-bold h-12 text-base"
            onClick={onRecordStroke}
          >
            <Scissors className="w-5 h-5" />
            Record Stroke ({nextStroke}/{maxStrokes}) — {piecesPerStroke} pcs
          </Button>
        )}

        {/* Complete run */}
        {allDone && canWrite && (
          <Button
            className="flex-1 gap-2 font-bold h-12 text-base bg-primary text-primary-foreground"
            onClick={onCompleteRun}
          >
            <CheckCircle2 className="w-5 h-5" />
            Complete Run ({totalCutsDone} pcs)
          </Button>
        )}
      </div>
    </div>
  );
}
