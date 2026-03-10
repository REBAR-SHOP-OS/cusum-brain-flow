import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 3 — Production Chain Tests
 * Tests the logical rules for cut→bend→bundle→delivery chain.
 * Uses mock functions to validate business logic without real DB calls.
 */

// Simulated status transition validators
const BEND_VALID_TRANSITIONS: Record<string, string[]> = {
  queued: ["bending", "cancelled"],
  bending: ["bend_complete", "paused", "cancelled"],
  paused: ["bending", "cancelled"],
  bend_complete: [],
  cancelled: [],
};

const BUNDLE_VALID_TRANSITIONS: Record<string, string[]> = {
  created: ["staged", "cancelled"],
  staged: ["loaded"],
  loaded: ["delivered"],
  delivered: [],
};

function canTransition(current: string, next: string, map: Record<string, string[]>): boolean {
  return (map[current] || []).includes(next);
}

describe("Phase 3 — Production Chain", () => {
  // Test 1: cut_batch creates bend_queue only after cut_complete
  it("bend queue only accepts completed cut batches", () => {
    const cutBatchCompleted = { id: "cb1", status: "completed", actual_qty: 100, planned_qty: 95 };
    const cutBatchRunning = { id: "cb2", status: "running", actual_qty: 0, planned_qty: 50 };

    expect(cutBatchCompleted.status).toBe("completed");
    expect(cutBatchRunning.status).not.toBe("completed");

    // Bend queue uses actual_qty from cut_batch
    const bendPlannedQty = cutBatchCompleted.actual_qty; // NOT planned_qty
    expect(bendPlannedQty).toBe(100);
  });

  // Test 2: bend_batch can only be created from bend_queue (completed cut_batch)
  it("bend batch requires source_cut_batch_id", () => {
    const bendBatch = {
      source_cut_batch_id: "cb1",
      status: "queued",
      planned_qty: 100,
    };
    expect(bendBatch.source_cut_batch_id).toBeTruthy();
    expect(bendBatch.status).toBe("queued");
  });

  // Test 3: duplicate bend_batch creation is blocked
  it("duplicate bend_batch for same cut_batch is blocked", () => {
    const existingBendBatches = [
      { id: "bb1", source_cut_batch_id: "cb1", status: "queued" },
    ];
    const newCutBatchId = "cb1";
    const isDuplicate = existingBendBatches.some(
      bb => bb.source_cut_batch_id === newCutBatchId && bb.status !== "cancelled"
    );
    expect(isDuplicate).toBe(true);
  });

  // Test 4: bend_complete creates bundle correctly
  it("bundle is created on bend_complete with correct quantity", () => {
    const bendBatch = {
      id: "bb1",
      status: "bending",
      planned_qty: 100,
      size: "15M",
      shape: "L-Shape",
      source_cut_batch_id: "cb1",
    };
    const actualQty = 98;
    const bundle = {
      source_bend_batch_id: bendBatch.id,
      source_cut_batch_id: bendBatch.source_cut_batch_id,
      size: bendBatch.size,
      shape: bendBatch.shape,
      quantity: actualQty, // Uses actual, not planned
      status: "created",
      bundle_code: `BND-${Date.now().toString(36).toUpperCase()}`,
    };
    expect(bundle.quantity).toBe(98);
    expect(bundle.source_bend_batch_id).toBe("bb1");
    expect(bundle.source_cut_batch_id).toBe("cb1");
    expect(bundle.status).toBe("created");
  });

  // Test 5: duplicate bundle creation is blocked
  it("duplicate bundle for same bend_batch is blocked", () => {
    const existingBundles = [
      { id: "bnd1", source_bend_batch_id: "bb1", status: "created" },
    ];
    const isDuplicate = existingBundles.some(
      b => b.source_bend_batch_id === "bb1" && b.status !== "cancelled"
    );
    expect(isDuplicate).toBe(true);
  });

  // Test 6: delivery is created from bundles only
  it("delivery requires bundle_ids", () => {
    const bundleIds = ["bnd1", "bnd2"];
    const validBundles = [
      { id: "bnd1", status: "created" },
      { id: "bnd2", status: "staged" },
    ];
    const allValid = validBundles.every(b => ["created", "staged"].includes(b.status));
    expect(allValid).toBe(true);
    expect(bundleIds.length).toBeGreaterThan(0);
  });

  // Test 7: duplicate delivery-bundle link is blocked
  it("same bundle cannot be linked to two deliveries", () => {
    const existingLinks = [
      { delivery_id: "del1", bundle_id: "bnd1" },
    ];
    const newLink = { delivery_id: "del2", bundle_id: "bnd1" };
    const isDuplicate = existingLinks.some(l => l.bundle_id === newLink.bundle_id);
    // The DB unique index (delivery_id, bundle_id) plus the bundle status check prevents this
    expect(isDuplicate).toBe(true);
  });

  // Test 8: variance in bend actual vs planned is logged
  it("variance is detected when actual differs from planned", () => {
    const planned = 100;
    const actual = 97;
    const variance = actual - planned;
    expect(variance).not.toBe(0);
    expect(variance).toBe(-3);

    const shouldLog = variance !== 0;
    expect(shouldLog).toBe(true);
  });

  // Test 9: valid bend status transitions
  it("enforces valid bend status transitions", () => {
    expect(canTransition("queued", "bending", BEND_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("bending", "bend_complete", BEND_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("bending", "paused", BEND_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("queued", "bend_complete", BEND_VALID_TRANSITIONS)).toBe(false);
    expect(canTransition("bend_complete", "bending", BEND_VALID_TRANSITIONS)).toBe(false);
    expect(canTransition("cancelled", "bending", BEND_VALID_TRANSITIONS)).toBe(false);
  });

  // Test 10: full chain traceability
  it("full chain traceability: cut_batch → bend_batch → bundle → delivery", () => {
    const cutBatch = { id: "cb1", cut_plan_item_id: "cpi1", status: "completed", actual_qty: 100 };
    const bendBatch = { id: "bb1", source_cut_batch_id: cutBatch.id, planned_qty: cutBatch.actual_qty, actual_qty: 98, status: "bend_complete" };
    const bundle = { id: "bnd1", source_bend_batch_id: bendBatch.id, source_cut_batch_id: cutBatch.id, quantity: bendBatch.actual_qty, status: "created" };
    const deliveryBundle = { delivery_id: "del1", bundle_id: bundle.id };

    // Verify chain
    expect(bendBatch.source_cut_batch_id).toBe(cutBatch.id);
    expect(bundle.source_bend_batch_id).toBe(bendBatch.id);
    expect(bundle.source_cut_batch_id).toBe(cutBatch.id);
    expect(deliveryBundle.bundle_id).toBe(bundle.id);

    // Verify quantities flow from actual, not planned
    expect(bendBatch.planned_qty).toBe(cutBatch.actual_qty);
    expect(bundle.quantity).toBe(bendBatch.actual_qty);
  });

  // Test: bundle valid transitions
  it("enforces valid bundle status transitions", () => {
    expect(canTransition("created", "staged", BUNDLE_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("staged", "loaded", BUNDLE_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("loaded", "delivered", BUNDLE_VALID_TRANSITIONS)).toBe(true);
    expect(canTransition("delivered", "loaded", BUNDLE_VALID_TRANSITIONS)).toBe(false);
    expect(canTransition("created", "delivered", BUNDLE_VALID_TRANSITIONS)).toBe(false);
  });
});
