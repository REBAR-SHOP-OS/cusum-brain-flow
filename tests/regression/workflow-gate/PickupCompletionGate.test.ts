/**
 * Regression: C7 Pickup completion gate.
 *
 * The production gate lives in two places:
 *   1. supabase/migrations/...PickupCompletionGate (validate_pickup_completion)
 *      — BEFORE UPDATE trigger on pickup_orders that blocks transitions into
 *      'released' / 'collected' unless signature, final photo, and a fully
 *      verified item checklist exist.
 *   2. src/components/shopfloor/PickupVerification.tsx — UI pre-gate that
 *      keeps the Authorize button disabled until the same proofs exist.
 *
 * These tests use:
 *   - a spec mirror of the trigger logic, exercised against the four
 *     scenarios called out in the request
 *   - drift checks against the migration SQL and the UI component so
 *     either side regressing fails this suite
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PickupRow {
  status: string;
  signature_data: string | null;
  final_photo_path: string | null;
}
interface PickupItem {
  verified: boolean;
}

// ── Spec mirror of validate_pickup_completion ──
function gatePickupCompletion(
  oldRow: PickupRow,
  newRow: PickupRow,
  items: PickupItem[],
  overrideActive = false,
): { ok: true } | { ok: false; code: string } {
  if (!["released", "collected"].includes(newRow.status)) return { ok: true };
  if (oldRow.status === newRow.status) return { ok: true };
  if (overrideActive) return { ok: true };

  if (!newRow.signature_data || newRow.signature_data.trim().length === 0) {
    return { ok: false, code: "WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED" };
  }
  if (!newRow.final_photo_path || newRow.final_photo_path.trim().length === 0) {
    return { ok: false, code: "WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED" };
  }
  if (items.length === 0) {
    return { ok: false, code: "WORKFLOW_GATE_PICKUP_NO_ITEMS" };
  }
  if (items.some((i) => !i.verified)) {
    return { ok: false, code: "WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE" };
  }
  return { ok: true };
}

const READY: PickupRow = { status: "pending", signature_data: null, final_photo_path: null };
const FULL_ITEMS: PickupItem[] = [{ verified: true }, { verified: true }];

describe("Pickup completion gate (spec mirror)", () => {
  it("blocks completion when final photo is missing", () => {
    const next: PickupRow = { status: "released", signature_data: "sig-path", final_photo_path: null };
    const r = gatePickupCompletion(READY, next, FULL_ITEMS);
    expect(r).toEqual({ ok: false, code: "WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED" });
  });

  it("blocks completion when signature is missing", () => {
    const next: PickupRow = { status: "released", signature_data: null, final_photo_path: "p.jpg" };
    const r = gatePickupCompletion(READY, next, FULL_ITEMS);
    expect(r).toEqual({ ok: false, code: "WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED" });
  });

  it("blocks completion when item checklist is incomplete", () => {
    const next: PickupRow = { status: "released", signature_data: "sig", final_photo_path: "p.jpg" };
    const r = gatePickupCompletion(READY, next, [{ verified: true }, { verified: false }]);
    expect(r).toEqual({ ok: false, code: "WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE" });
  });

  it("blocks completion when there are no items at all", () => {
    const next: PickupRow = { status: "released", signature_data: "sig", final_photo_path: "p.jpg" };
    expect(gatePickupCompletion(READY, next, [])).toEqual({
      ok: false,
      code: "WORKFLOW_GATE_PICKUP_NO_ITEMS",
    });
  });

  it("allows completion when signature, photo, and all items are confirmed", () => {
    const next: PickupRow = { status: "released", signature_data: "sig", final_photo_path: "p.jpg" };
    expect(gatePickupCompletion(READY, next, FULL_ITEMS)).toEqual({ ok: true });
  });

  it("does not gate non-completion updates", () => {
    const next: PickupRow = { ...READY, status: "ready" };
    expect(gatePickupCompletion(READY, next, [])).toEqual({ ok: true });
  });

  it("respects supervisor override", () => {
    const next: PickupRow = { status: "released", signature_data: null, final_photo_path: null };
    expect(gatePickupCompletion(READY, next, [], true)).toEqual({ ok: true });
  });
});

describe("PickupCompletionGate migration drift check", () => {
  // Migration filename pinned for stability — the trigger function name
  // and four error codes are what really matter, so we grep the whole
  // migrations directory rather than a single file.
  const sqlGlobMatch = (needle: string) => {
    const dir = resolve(__dirname, "../../../supabase/migrations");
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .some((f) => readFileSync(resolve(dir, f), "utf8").includes(needle));
  };

  it("ships the validate_pickup_completion trigger function", () => {
    expect(sqlGlobMatch("FUNCTION public.validate_pickup_completion")).toBe(true);
    expect(sqlGlobMatch("trg_validate_pickup_completion")).toBe(true);
  });

  it("declares all four pickup gate error codes", () => {
    expect(sqlGlobMatch("WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED")).toBe(true);
    expect(sqlGlobMatch("WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED")).toBe(true);
    expect(sqlGlobMatch("WORKFLOW_GATE_PICKUP_NO_ITEMS")).toBe(true);
    expect(sqlGlobMatch("WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE")).toBe(true);
  });

  it("logs pickup_completed audit event", () => {
    expect(sqlGlobMatch("pickup_completed")).toBe(true);
    expect(sqlGlobMatch("log_pickup_completed")).toBe(true);
  });
});

describe("PickupVerification UI drift check", () => {
  const src = readFileSync(
    resolve(__dirname, "../../../src/components/shopfloor/PickupVerification.tsx"),
    "utf8",
  );

  it("captures a final load photo", () => {
    expect(src).toMatch(/Final Load Photo/);
    expect(src).toMatch(/capture="environment"/);
  });

  it("keeps Authorize button disabled until photo, signature, and all items are confirmed", () => {
    expect(src).toContain("const canAuthorize = canWrite && !!signature && !!photoFile && allVerified");
    expect(src).toContain("disabled={!canAuthorize}");
  });

  it("passes the photo file to onAuthorize", () => {
    expect(src).toContain("onAuthorize: (signatureData: string, photoFile: File) => void");
    expect(src).toContain("onAuthorize(signature, photoFile)");
  });
});

describe("workflowGateError pickup message mapping", () => {
  it("maps every pickup gate code to a friendly message", async () => {
    const { mapWorkflowGateError } = await import("../../../src/lib/workflowGateError");
    for (const code of [
      "WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED",
      "WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED",
      "WORKFLOW_GATE_PICKUP_NO_ITEMS",
      "WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE",
    ]) {
      const r = mapWorkflowGateError({ message: `${code}: trigger said no` });
      expect(r?.code).toBe(code);
      expect(r?.description).not.toMatch(/^WORKFLOW_/);
    }
  });
});
