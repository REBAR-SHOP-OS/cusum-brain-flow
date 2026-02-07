import { useState, useCallback, useEffect } from "react";
import type { RunPlan } from "@/lib/foremanBrain";
import type { ActiveSlot, SlotStatus } from "@/components/shopfloor/SlotTracker";

interface UseSlotTrackerOpts {
  runPlan: RunPlan | null;
  isRunning: boolean;
}

export interface SlotTrackerResult {
  slots: ActiveSlot[];
  /** Record a single stroke — increments cutsDone for ALL active bars */
  recordStroke: () => void;
  /** Remove a bar at the given slot index (must be "removable") */
  removeBar: (slotIndex: number) => void;
  /** True when all slots are completed or removed */
  allDone: boolean;
  /** Reset slot state (e.g. when run stops) */
  reset: () => void;
  /** Total cuts done across all slots */
  totalCutsDone: number;
  /** Start slots with a specific bar count (operator override) */
  startWithBars: (bars: number) => void;
}

/**
 * Build slots from RunPlan, optionally overriding bar count.
 * When overrideBars is provided, we rebuild the slot array to match
 * the actual number of bars the operator loaded.
 */
function buildSlots(plan: RunPlan, overrideBars?: number): ActiveSlot[] {
  const piecesPerBar = plan.piecesPerBar;
  const barsToUse = overrideBars ?? plan.barsThisRun;
  
  if (piecesPerBar <= 0 || barsToUse <= 0) return [];

  // Total remaining pieces from the plan
  const totalRemaining = plan.slots.reduce((sum, s) => sum + s.plannedCuts, 0);
  // Recompute for the actual bars loaded
  const totalPiecesThisRun = overrideBars
    ? Math.min(totalRemaining + ((overrideBars - plan.barsThisRun) * piecesPerBar), overrideBars * piecesPerBar)
    : totalRemaining;

  const slots: ActiveSlot[] = [];
  let piecesAssigned = 0;

  for (let i = 0; i < barsToUse; i++) {
    const piecesLeft = totalPiecesThisRun - piecesAssigned;
    if (piecesLeft <= 0) break;

    const cutsThisSlot = Math.min(piecesPerBar, piecesLeft);
    const isPartial = cutsThisSlot < piecesPerBar;

    slots.push({
      index: i,
      plannedCuts: cutsThisSlot,
      cutsDone: 0,
      // All bars are loaded simultaneously — all start active
      status: "active" as SlotStatus,
      isPartial,
    });

    piecesAssigned += cutsThisSlot;
  }

  return slots;
}

export function useSlotTracker({ runPlan, isRunning }: UseSlotTrackerOpts): SlotTrackerResult {
  const [slots, setSlots] = useState<ActiveSlot[]>([]);

  // Reset when run stops
  useEffect(() => {
    if (!isRunning) {
      // Don't auto-clear — only reset() does that
    }
  }, [isRunning]);

  /**
   * Called by CutterStationView on LOCK & START with the actual bar count
   * the operator chose. This is the primary way to initialize slots.
   */
  const startWithBars = useCallback((bars: number) => {
    if (!runPlan?.feasible) return;
    setSlots(buildSlots(runPlan, bars));
  }, [runPlan]);

  // Fallback: auto-init from runPlan if startWithBars wasn't called
  useEffect(() => {
    if (isRunning && runPlan?.feasible && runPlan.slots.length > 0 && slots.length === 0) {
      setSlots(buildSlots(runPlan));
    }
  }, [isRunning, runPlan, slots.length]);

  const recordStroke = useCallback(() => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));

      // A single physical stroke cuts ALL active bars simultaneously
      const activeBars = next.filter((s) => s.status === "active");
      if (activeBars.length === 0) return prev;

      for (const slot of activeBars) {
        slot.cutsDone += 1;

        // Check if this slot's planned cuts are done
        if (slot.cutsDone >= slot.plannedCuts) {
          if (slot.isPartial) {
            // Partial bar → removable (operator must physically remove it)
            slot.status = "removable";
          } else {
            // Full bar → completed automatically
            slot.status = "completed";
          }
        }
      }

      return next;
    });
  }, []);

  const removeBar = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const slot = next.find((s) => s.index === slotIndex);
      if (!slot || slot.status !== "removable") return prev;

      slot.status = "removed";
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSlots([]);
  }, []);

  const allDone = slots.length > 0 && slots.every(
    (s) => s.status === "completed" || s.status === "removed"
  );

  const totalCutsDone = slots.reduce((s, sl) => s + sl.cutsDone, 0);

  return { slots, recordStroke, removeBar, allDone, reset, totalCutsDone, startWithBars };
}
