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
 *
 * Physical model: ALL loaded bars are cut simultaneously on each stroke.
 * Partial bar = the last bar that needs fewer cuts than piecesPerBar.
 * After the partial bar's cuts are done, operator removes it and continues.
 *
 * Edge cases handled:
 *   1. remaining >= bars * piecesPerBar → all bars full, no partial
 *   2. remaining < bars * piecesPerBar → last bar is partial, removed early
 *   3. bars > totalBarsNeeded → extra bars all get full cuts (excess to stock)
 */
function buildSlots(plan: RunPlan, overrideBars?: number): ActiveSlot[] {
  const piecesPerBar = plan.piecesPerBar;
  const barsToUse = overrideBars ?? plan.barsThisRun;

  if (piecesPerBar <= 0 || barsToUse <= 0) return [];

  // Total remaining pieces in the ENTIRE order (not just this run)
  const totalRemaining = plan.lastBarPieces > 0
    ? (plan.totalBarsNeeded - 1) * piecesPerBar + plan.lastBarPieces
    : plan.totalBarsNeeded * piecesPerBar;

  // Full capacity if every bar gets max cuts
  const fullCapacity = barsToUse * piecesPerBar;

  const slots: ActiveSlot[] = [];

  if (fullCapacity <= totalRemaining) {
    // ── Case 1: We need ALL these pieces (and more). Every bar gets full cuts.
    for (let i = 0; i < barsToUse; i++) {
      slots.push({
        index: i,
        plannedCuts: piecesPerBar,
        cutsDone: 0,
        status: "active" as SlotStatus,
        isPartial: false,
      });
    }
  } else {
    // ── Case 2: This run can finish the remaining order.
    // Distribute remaining pieces across bars. Last bar may be partial.
    let piecesAssigned = 0;
    for (let i = 0; i < barsToUse; i++) {
      const piecesLeft = totalRemaining - piecesAssigned;

      if (piecesLeft <= 0) {
        // Extra bars beyond order needs — still loaded, get full cuts (excess → WIP stock)
        slots.push({
          index: i,
          plannedCuts: piecesPerBar,
          cutsDone: 0,
          status: "active" as SlotStatus,
          isPartial: false,
        });
        piecesAssigned += piecesPerBar;
      } else {
        const cutsThisSlot = Math.min(piecesPerBar, piecesLeft);
        const isPartial = cutsThisSlot < piecesPerBar;

        slots.push({
          index: i,
          plannedCuts: cutsThisSlot,
          cutsDone: 0,
          status: "active" as SlotStatus,
          isPartial,
        });
        piecesAssigned += cutsThisSlot;
      }
    }
  }

  return slots;
}

export function useSlotTracker({ runPlan, isRunning }: UseSlotTrackerOpts): SlotTrackerResult {
  const [slots, setSlots] = useState<ActiveSlot[]>([]);

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
