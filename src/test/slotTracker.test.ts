import { describe, it, expect } from "vitest";

// We test buildSlots logic by importing and simulating the hook's core function.
// Since buildSlots is not exported, we replicate the logic here for unit testing.

type SlotStatus = "waiting" | "active" | "removable" | "removed" | "completed";

interface ActiveSlot {
  index: number;
  plannedCuts: number;
  cutsDone: number;
  status: SlotStatus;
  isPartial: boolean;
}

interface RunPlan {
  piecesPerBar: number;
  totalBarsNeeded: number;
  lastBarPieces: number;
  barsThisRun: number;
  slots: { index: number; plannedCuts: number; status: string; removeAfterCuts: boolean }[];
  feasible: boolean;
}

// Replicate buildSlots from useSlotTracker.ts
function buildSlots(plan: RunPlan, overrideBars?: number): ActiveSlot[] {
  const piecesPerBar = plan.piecesPerBar;
  const barsToUse = overrideBars ?? plan.barsThisRun;

  if (piecesPerBar <= 0 || barsToUse <= 0) return [];

  const totalRemaining = plan.lastBarPieces > 0
    ? (plan.totalBarsNeeded - 1) * piecesPerBar + plan.lastBarPieces
    : plan.totalBarsNeeded * piecesPerBar;

  const fullCapacity = barsToUse * piecesPerBar;
  const slots: ActiveSlot[] = [];

  if (fullCapacity <= totalRemaining) {
    for (let i = 0; i < barsToUse; i++) {
      slots.push({ index: i, plannedCuts: piecesPerBar, cutsDone: 0, status: "active", isPartial: false });
    }
  } else {
    let piecesAssigned = 0;
    for (let i = 0; i < barsToUse; i++) {
      const piecesLeft = totalRemaining - piecesAssigned;
      if (piecesLeft <= 0) {
        slots.push({ index: i, plannedCuts: piecesPerBar, cutsDone: 0, status: "active", isPartial: false });
        piecesAssigned += piecesPerBar;
      } else {
        const cutsThisSlot = Math.min(piecesPerBar, piecesLeft);
        const isPartial = cutsThisSlot < piecesPerBar;
        slots.push({ index: i, plannedCuts: cutsThisSlot, cutsDone: 0, status: "active", isPartial });
        piecesAssigned += cutsThisSlot;
      }
    }
  }

  return slots;
}

// Simulate recording a stroke (cuts ALL active bars)
function recordStroke(slots: ActiveSlot[]): ActiveSlot[] {
  const next = slots.map((s) => ({ ...s }));
  const activeBars = next.filter((s) => s.status === "active");
  if (activeBars.length === 0) return slots;

  for (const slot of activeBars) {
    slot.cutsDone += 1;
    if (slot.cutsDone >= slot.plannedCuts) {
      if (slot.isPartial) {
        slot.status = "removable";
      } else {
        slot.status = "completed";
      }
    }
  }
  return next;
}

function removeBar(slots: ActiveSlot[], slotIndex: number): ActiveSlot[] {
  const next = slots.map((s) => ({ ...s }));
  const slot = next.find((s) => s.index === slotIndex);
  if (!slot || slot.status !== "removable") return slots;
  slot.status = "removed";
  return next;
}

function getStrokesDone(slots: ActiveSlot[]): number {
  return slots.length > 0 ? Math.max(...slots.map(s => s.cutsDone)) : 0;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("buildSlots", () => {
  it("10 bars loaded, 179 remaining, 5 pcs/bar → all 10 bars full (no partial)", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 36, lastBarPieces: 4,
      barsThisRun: 10, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 10);
    expect(slots).toHaveLength(10);
    expect(slots.every(s => s.plannedCuts === 5)).toBe(true);
    expect(slots.every(s => !s.isPartial)).toBe(true);
  });

  it("5 bars loaded, 22 remaining, 5 pcs/bar → 4 full + 1 partial(2)", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 5, lastBarPieces: 2,
      barsThisRun: 5, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 5);
    expect(slots).toHaveLength(5);
    expect(slots[0].plannedCuts).toBe(5);
    expect(slots[3].plannedCuts).toBe(5);
    expect(slots[4].plannedCuts).toBe(2);
    expect(slots[4].isPartial).toBe(true);
  });

  it("6 bars loaded, 22 remaining, 5 pcs/bar → 4 full + 1 partial(2) + 1 extra full", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 5, lastBarPieces: 2,
      barsThisRun: 5, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 6);
    expect(slots).toHaveLength(6);
    // First 4 are full
    expect(slots[0].plannedCuts).toBe(5);
    expect(slots[3].plannedCuts).toBe(5);
    // Slot 4 is partial (only 2 pieces needed)
    expect(slots[4].plannedCuts).toBe(2);
    expect(slots[4].isPartial).toBe(true);
    // Slot 5 is extra (beyond order needs) → full cuts (excess to WIP)
    expect(slots[5].plannedCuts).toBe(5);
    expect(slots[5].isPartial).toBe(false);
  });

  it("1 bar loaded, 3 remaining, 5 pcs/bar → partial bar (3 cuts)", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 1, lastBarPieces: 3,
      barsThisRun: 1, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 1);
    expect(slots).toHaveLength(1);
    expect(slots[0].plannedCuts).toBe(3);
    expect(slots[0].isPartial).toBe(true);
  });

  it("returns empty for invalid inputs", () => {
    const plan: RunPlan = {
      piecesPerBar: 0, totalBarsNeeded: 0, lastBarPieces: 0,
      barsThisRun: 0, slots: [], feasible: false,
    };
    expect(buildSlots(plan, 5)).toHaveLength(0);
  });
});

describe("stroke recording", () => {
  it("10 bars, 5 cuts each → 5 strokes produces 50 pieces", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 36, lastBarPieces: 4,
      barsThisRun: 10, slots: [], feasible: true,
    };
    let slots = buildSlots(plan, 10);

    for (let i = 0; i < 5; i++) {
      slots = recordStroke(slots);
    }

    const totalCuts = slots.reduce((s, sl) => s + sl.cutsDone, 0);
    expect(totalCuts).toBe(50); // 10 bars × 5 cuts
    expect(getStrokesDone(slots)).toBe(5);
    expect(slots.every(s => s.status === "completed")).toBe(true);
  });

  it("partial bar triggers removable status at the right stroke", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 5, lastBarPieces: 2,
      barsThisRun: 5, slots: [], feasible: true,
    };
    let slots = buildSlots(plan, 5);

    // Stroke 1: all 5 active
    slots = recordStroke(slots);
    expect(slots.filter(s => s.status === "active").length).toBe(5);

    // Stroke 2: partial bar (slot 4) becomes removable
    slots = recordStroke(slots);
    expect(slots[4].status).toBe("removable");
    expect(slots.filter(s => s.status === "active").length).toBe(4);

    // Remove bar 4
    slots = removeBar(slots, 4);
    expect(slots[4].status).toBe("removed");

    // Strokes 3-5: only 4 bars
    slots = recordStroke(slots);
    slots = recordStroke(slots);
    slots = recordStroke(slots);

    expect(getStrokesDone(slots)).toBe(5);
    expect(slots.filter(s => s.status === "completed").length).toBe(4);
    expect(slots.filter(s => s.status === "removed").length).toBe(1);
  });

  it("extra bar scenario: stroke count tracks correctly even when slot 0 is partial", () => {
    // remaining=3, loading 2 bars → slot 0 partial (3 cuts), slot 1 full (5 cuts)
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 1, lastBarPieces: 3,
      barsThisRun: 1, slots: [], feasible: true,
    };
    let slots = buildSlots(plan, 2);

    expect(slots[0].plannedCuts).toBe(3);
    expect(slots[0].isPartial).toBe(true);
    expect(slots[1].plannedCuts).toBe(5);
    expect(slots[1].isPartial).toBe(false);

    // Strokes 1-3: both bars cut
    slots = recordStroke(slots);
    slots = recordStroke(slots);
    slots = recordStroke(slots);

    // Slot 0 should be removable at 3 cuts
    expect(slots[0].status).toBe("removable");
    expect(slots[0].cutsDone).toBe(3);
    expect(slots[1].cutsDone).toBe(3);

    // Remove slot 0
    slots = removeBar(slots, 0);

    // Strokes 4-5: only slot 1
    slots = recordStroke(slots);
    slots = recordStroke(slots);

    expect(slots[1].status).toBe("completed");
    expect(slots[1].cutsDone).toBe(5);

    // CRITICAL: strokesDone should be 5, NOT 3 (which is slots[0].cutsDone)
    expect(getStrokesDone(slots)).toBe(5);
    // Verify Math.max works correctly
    expect(Math.max(...slots.map(s => s.cutsDone))).toBe(5);
  });

  it("all bars complete → allDone is true", () => {
    const plan: RunPlan = {
      piecesPerBar: 2, totalBarsNeeded: 3, lastBarPieces: 0,
      barsThisRun: 3, slots: [], feasible: true,
    };
    let slots = buildSlots(plan, 3);

    slots = recordStroke(slots);
    slots = recordStroke(slots);

    const allDone = slots.every(s => s.status === "completed" || s.status === "removed");
    expect(allDone).toBe(true);
  });

  it("no active bars → recordStroke is a no-op", () => {
    const plan: RunPlan = {
      piecesPerBar: 1, totalBarsNeeded: 1, lastBarPieces: 0,
      barsThisRun: 1, slots: [], feasible: true,
    };
    let slots = buildSlots(plan, 1);
    slots = recordStroke(slots); // completes
    const before = JSON.stringify(slots);
    slots = recordStroke(slots); // should be no-op
    expect(JSON.stringify(slots)).toBe(before);
  });
});

describe("computeRunPlan edge cases", () => {
  it("remaining pieces exactly divisible by piecesPerBar → no partial bar", () => {
    // 50 remaining, 5 pcs/bar = 10 bars needed, 0 lastBarPieces
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 10, lastBarPieces: 0,
      barsThisRun: 10, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 10);
    expect(slots.every(s => !s.isPartial)).toBe(true);
    expect(slots.every(s => s.plannedCuts === 5)).toBe(true);
  });

  it("1 piece remaining, 1 bar loaded → partial bar with 1 cut", () => {
    const plan: RunPlan = {
      piecesPerBar: 5, totalBarsNeeded: 1, lastBarPieces: 1,
      barsThisRun: 1, slots: [], feasible: true,
    };
    const slots = buildSlots(plan, 1);
    expect(slots[0].plannedCuts).toBe(1);
    expect(slots[0].isPartial).toBe(true);
  });
});
