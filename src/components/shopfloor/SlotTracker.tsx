import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Scissors,
  Trash2,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertTriangle,
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
  const allDone = slots.every(
    (s) => s.status === "completed" || s.status === "removed"
  );
  const totalCutsDone = slots.reduce((s, sl) => s + sl.cutsDone, 0);
  const totalPlanned = slots.reduce((s, sl) => s + sl.plannedCuts, 0);
  const nextStroke = activeSlots.length > 0 ? activeSlots[0].cutsDone + 1 : 0;
  const maxStrokes = activeSlots.length > 0 ? Math.max(...activeSlots.map(s => s.plannedCuts)) : 0;
  const piecesPerStroke = activeSlots.length;
  const strokesDone = activeSlots.length > 0 ? activeSlots[0].cutsDone : (slots.length > 0 ? slots[0].cutsDone : 0);

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
        <Badge variant="outline" className="font-mono text-xs flex items-center gap-1.5">
          <span>{strokesDone}/{maxStrokes || slots[0]?.plannedCuts || 0} strokes</span>
          <span className="text-muted-foreground">·</span>
          <span>{totalCutsDone}/{totalPlanned} pcs</span>
        </Badge>
      </div>

      {/* ── Slot grid ── */}
      <div className="grid gap-2">
        {slots.map((slot) => {
          const leftover = computeLeftover(stockLengthMm, slot.cutsDone, cutLengthMm);
          const isRemnant = leftover >= REMNANT_THRESHOLD_MM;
          const progress =
            slot.plannedCuts > 0 ? (slot.cutsDone / slot.plannedCuts) * 100 : 0;

          return (
            <Card
              key={slot.index}
              className={cn(
                "border transition-colors",
                slot.status === "active" && "border-primary bg-primary/5",
                slot.status === "removable" && "border-accent bg-accent/20",
                slot.status === "completed" && "border-primary/30 bg-primary/5 opacity-60",
                slot.status === "removed" && "border-muted opacity-40",
                slot.status === "waiting" && "border-border"
              )}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {/* Status icon */}
                <div className="shrink-0">
                  {slot.status === "completed" && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                  {slot.status === "removed" && (
                    <Trash2 className="w-5 h-5 text-muted-foreground" />
                  )}
                  {slot.status === "active" && (
                    <Scissors className="w-5 h-5 text-primary animate-pulse" />
                  )}
                  {slot.status === "removable" && (
                    <AlertTriangle className="w-5 h-5 text-accent-foreground" />
                  )}
                  {slot.status === "waiting" && (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Slot info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono">
                      Bar {slot.index + 1}
                    </span>
                    {slot.isPartial && (
                      <Badge variant="secondary" className="text-[9px] uppercase tracking-wider py-0">
                        Partial
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] uppercase tracking-wider py-0",
                        slot.status === "active" && "border-primary text-primary",
                        slot.status === "removable" && "border-accent text-accent-foreground"
                      )}
                    >
                      {slot.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      {slot.cutsDone}/{slot.plannedCuts} cuts
                    </span>
                    {(slot.status === "removable" || slot.status === "removed") && (
                      <span className={cn(
                        "text-[10px] font-mono",
                        isRemnant ? "text-primary" : "text-destructive"
                      )}>
                        {isRemnant ? `Remnant: ${leftover}mm` : `Scrap: ${leftover}mm`}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        slot.status === "completed" || slot.status === "removed"
                          ? "bg-primary"
                          : "bg-primary/60"
                      )}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>

                {/* REMOVE BAR button — only when slot is removable */}
                {slot.status === "removable" && canWrite && (
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
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-2">
        {/* Record stroke (only when there are active slots) */}
        {activeSlots.length > 0 && canWrite && (
          <Button
            className="flex-1 gap-2 font-bold"
            onClick={onRecordStroke}
          >
            <Scissors className="w-4 h-4" />
            Record Stroke ({nextStroke}/{maxStrokes}) — {piecesPerStroke} piece{piecesPerStroke > 1 ? "s" : ""}
          </Button>
        )}

        {/* Complete run (only when all slots done) */}
        {allDone && canWrite && (
          <Button
            className="flex-1 gap-2 font-bold bg-primary text-primary-foreground"
            onClick={onCompleteRun}
          >
            <CheckCircle2 className="w-4 h-4" />
            Complete Run
          </Button>
        )}
      </div>

      {/* Removable slots prompt */}
      {removableSlots.length > 0 && !allDone && (
        <Card className="border-accent bg-accent/20">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-foreground shrink-0" />
            <p className="text-xs text-accent-foreground font-medium">
              Bar {removableSlots.map((s) => s.index + 1).join(", ")} ready to remove — 
              set aside leftover as{" "}
              {computeLeftover(stockLengthMm, removableSlots[0].cutsDone, cutLengthMm) >= REMNANT_THRESHOLD_MM
                ? "remnant"
                : "scrap"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
