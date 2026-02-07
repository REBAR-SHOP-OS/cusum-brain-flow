import { useState, useCallback, useEffect } from "react";
import type { RunPlan, RunSlot } from "@/lib/foremanBrain";
import type { ActiveSlot, SlotStatus } from "@/components/shopfloor/SlotTracker";

interface UseSlotTrackerOpts {
  runPlan: RunPlan | null;
  isRunning: boolean;
}

export interface SlotTrackerResult {
  slots: ActiveSlot[];
  /** Record a single stroke on the current active slot */
  recordStroke: () => void;
  /** Remove a bar at the given slot index (must be "removable") */
  removeBar: (slotIndex: number) => void;
  /** True when all slots are completed or removed */
  allDone: boolean;
  /** Reset slot state (e.g. when run stops) */
  reset: () => void;
  /** Total cuts done across all slots */
  totalCutsDone: number;
}

function buildSlots(plan: RunPlan): ActiveSlot[] {
  return plan.slots.map((s, i) => ({
    index: s.index,
    plannedCuts: s.plannedCuts,
    cutsDone: 0,
    // First slot is active, rest are waiting
    status: (i === 0 ? "active" : "waiting") as SlotStatus,
    isPartial: s.removeAfterCuts,
  }));
}

export function useSlotTracker({ runPlan, isRunning }: UseSlotTrackerOpts): SlotTrackerResult {
  const [slots, setSlots] = useState<ActiveSlot[]>([]);

  // Initialize slots when a run starts with a valid plan
  useEffect(() => {
    if (isRunning && runPlan?.feasible && runPlan.slots.length > 0 && slots.length === 0) {
      setSlots(buildSlots(runPlan));
    }
  }, [isRunning, runPlan, slots.length]);

  const recordStroke = useCallback(() => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const activeIdx = next.findIndex((s) => s.status === "active");
      if (activeIdx === -1) return prev;

      const slot = next[activeIdx];
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

        // Activate the next waiting slot
        const nextWaiting = next.find((s) => s.status === "waiting");
        if (nextWaiting) {
          nextWaiting.status = "active";
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

      // If there are still waiting slots, activate next
      const nextWaiting = next.find((s) => s.status === "waiting");
      if (nextWaiting) {
        nextWaiting.status = "active";
      }

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

  return { slots, recordStroke, removeBar, allDone, reset, totalCutsDone };
}
