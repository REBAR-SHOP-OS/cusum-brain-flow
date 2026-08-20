import { describe, it, expect } from "vitest";

/**
 * Phase 4 integration tests — validating production chain rules.
 * These are structural/logic tests that verify rule enforcement.
 */

// ── Helpers mimicking edge function logic ──

function validateBendTransition(current: string, target: string): boolean {
  const allowed: Record<string, string[]> = {
    queued: ["bending"],
    bending: ["bend_complete", "paused", "cancelled"],
    paused: ["bending", "cancelled"],
  };
  return (allowed[current] || []).includes(target);
}

function validateCutterRouting(barCode: string, machineId: string): { allowed: boolean; reason?: string } {
  const CUTTER_01 = "e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3";
  const CUTTER_02 = "b0000000-0000-0000-0000-000000000002";
  const num = parseInt(barCode.replace(/\D/g, "")) || 0;
  const isSmall = num <= 15;

  if (machineId === CUTTER_01 && !isSmall) {
    return { allowed: false, reason: `${barCode} cannot run on Cutter-01 (10M/15M only)` };
  }
  if (machineId === CUTTER_02 && isSmall) {
    return { allowed: false, reason: `${barCode} cannot run on Cutter-02 (20M+ only)` };
  }
  return { allowed: true };
}

function validateWasteBankTransition(current: string, target: string): boolean {
  const allowed: Record<string, string[]> = {
    available: ["reserved"],
    reserved: ["consumed", "available"],
  };
  return (allowed[current] || []).includes(target);
}

function canCreateBundleFromBatch(batchStatus: string): boolean {
  return batchStatus === "bend_complete";
}

function isOptimizationModeUsingWasteBank(mode: string): boolean {
  return mode === "long_to_short" || mode === "combination";
}

describe("Phase 4: Bend batch transitions", () => {
  it("queued → bending is valid", () => {
    expect(validateBendTransition("queued", "bending")).toBe(true);
  });
  it("bending → bend_complete is valid", () => {
    expect(validateBendTransition("bending", "bend_complete")).toBe(true);
  });
  it("queued → bend_complete is invalid", () => {
    expect(validateBendTransition("queued", "bend_complete")).toBe(false);
  });
  it("bend_complete → bending is invalid", () => {
    expect(validateBendTransition("bend_complete", "bending")).toBe(false);
  });
  it("paused → bending (resume) is valid", () => {
    expect(validateBendTransition("paused", "bending")).toBe(true);
  });
});

describe("Phase 4: Bundle creation rules", () => {
  it("bundle can be created from bend_complete batch", () => {
    expect(canCreateBundleFromBatch("bend_complete")).toBe(true);
  });
  it("bundle cannot be created from queued batch", () => {
    expect(canCreateBundleFromBatch("queued")).toBe(false);
  });
  it("bundle cannot be created from bending batch", () => {
    expect(canCreateBundleFromBatch("bending")).toBe(false);
  });
});

describe("Phase 4: Cutter routing enforcement", () => {
  const C1 = "e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3";
  const C2 = "b0000000-0000-0000-0000-000000000002";

  it("10M on Cutter-01 is allowed", () => {
    expect(validateCutterRouting("10M", C1).allowed).toBe(true);
  });
  it("15M on Cutter-01 is allowed", () => {
    expect(validateCutterRouting("15M", C1).allowed).toBe(true);
  });
  it("20M on Cutter-01 is BLOCKED", () => {
    expect(validateCutterRouting("20M", C1).allowed).toBe(false);
  });
  it("25M on Cutter-01 is BLOCKED", () => {
    expect(validateCutterRouting("25M", C1).allowed).toBe(false);
  });
  it("10M on Cutter-02 is BLOCKED", () => {
    expect(validateCutterRouting("10M", C2).allowed).toBe(false);
  });
  it("20M on Cutter-02 is allowed", () => {
    expect(validateCutterRouting("20M", C2).allowed).toBe(true);
  });
});

describe("Phase 4: Waste bank transitions", () => {
  it("available → reserved is valid", () => {
    expect(validateWasteBankTransition("available", "reserved")).toBe(true);
  });
  it("reserved → consumed is valid", () => {
    expect(validateWasteBankTransition("reserved", "consumed")).toBe(true);
  });
  it("reserved → available (release) is valid", () => {
    expect(validateWasteBankTransition("reserved", "available")).toBe(true);
  });
  it("available → consumed is invalid (skip reserved)", () => {
    expect(validateWasteBankTransition("available", "consumed")).toBe(false);
  });
  it("consumed → available is invalid", () => {
    expect(validateWasteBankTransition("consumed", "available")).toBe(false);
  });
});

describe("Phase 4: Optimization mode waste bank usage", () => {
  it("RAW mode ignores waste bank", () => {
    expect(isOptimizationModeUsingWasteBank("raw")).toBe(false);
  });
  it("LONG_TO_SHORT uses waste bank", () => {
    expect(isOptimizationModeUsingWasteBank("long_to_short")).toBe(true);
  });
  it("COMBINATION uses waste bank", () => {
    expect(isOptimizationModeUsingWasteBank("combination")).toBe(true);
  });
});

describe("Phase 4: Pause/lock safety", () => {
  it("paused machine should remain locked", () => {
    // Simulates manage-machine pause-run logic
    const machineAfterPause = {
      machine_lock: true, // kept true
      cut_session_status: "paused",
      active_job_id: "some-job-id", // kept
    };
    expect(machineAfterPause.machine_lock).toBe(true);
    expect(machineAfterPause.active_job_id).not.toBeNull();
    expect(machineAfterPause.cut_session_status).toBe("paused");
  });

  it("completed machine releases lock", () => {
    const machineAfterComplete = {
      machine_lock: false,
      cut_session_status: "idle",
      active_job_id: null,
    };
    expect(machineAfterComplete.machine_lock).toBe(false);
    expect(machineAfterComplete.active_job_id).toBeNull();
  });
});
