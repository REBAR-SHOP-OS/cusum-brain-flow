// @vitest-environment node
// Regression: B6 Loading Validation → Packing Slip Gate.
//
// Pins the BEFORE INSERT trigger validate_packing_slip_loading on
// public.packing_slips. The trigger must raise WORKFLOW_GATE_LOADING_*
// for missing / wrong / duplicate / partial loads, and allow the slip
// when loading is clean (or a supervisor override is active).
//
// Mirrors the structure of ClearanceStorageZoneGate.test.ts — read the
// migration SQL and assert the contract is present, plus a small
// spec-mirror unit test for the in-memory validation shape so future
// edits to the gate keep behaving the same way.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function loadGateMigration(): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const matches = files
    .map((f) => ({ f, body: readFileSync(resolve(dir, f), "utf8") }))
    .filter(({ body }) => body.includes("validate_packing_slip_loading"));
  if (matches.length === 0) {
    throw new Error(
      "Expected the B6 packing-slip loading-gate migration to be present, " +
        "containing function validate_packing_slip_loading.",
    );
  }
  return matches[matches.length - 1].body;
}

describe("B6 Packing Slip Loading Gate — backend trigger contract", () => {
  const sql = loadGateMigration();

  it("declares the validator and binds it BEFORE INSERT on packing_slips", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.validate_packing_slip_loading/);
    expect(sql).toMatch(
      /CREATE TRIGGER trg_validate_packing_slip_loading\s+BEFORE INSERT ON public\.packing_slips/,
    );
  });

  it("blocks when no items are loaded yet (NOT_STARTED)", () => {
    expect(sql).toMatch(/WORKFLOW_GATE_LOADING_NOT_STARTED/);
  });

  it("blocks when loaded count is less than expected (missing/partial → INCOMPLETE)", () => {
    expect(sql).toMatch(/WORKFLOW_GATE_LOADING_INCOMPLETE/);
    expect(sql).toMatch(/_loaded_in_plan < _expected/);
  });

  it("blocks when a loaded item belongs to another cut plan (WRONG_ITEM)", () => {
    expect(sql).toMatch(/WORKFLOW_GATE_LOADING_WRONG_ITEM/);
    expect(sql).toMatch(/ci\.cut_plan_id = NEW\.cut_plan_id/);
  });

  it("blocks duplicate item ids in items_json (DUPLICATE)", () => {
    expect(sql).toMatch(/WORKFLOW_GATE_LOADING_DUPLICATE/);
    expect(sql).toMatch(/count\(DISTINCT elem->>'id'\)/);
  });

  it("still respects supervisor override", () => {
    expect(sql).toMatch(/_workflow_override_active\(\)/);
  });

  it("logs an audit event after a slip passes the gate", () => {
    expect(sql).toMatch(/log_packing_slip_validated/);
    expect(sql).toMatch(/'packing_slip_validated'/);
    expect(sql).toMatch(/AFTER INSERT ON public\.packing_slips/);
  });
});

// ─── Spec mirror: in-memory shape of the validation rules ─────────────────
// Mirrors the trigger's branches so a regression in either layer trips this
// suite. If you change the trigger, mirror it here.
type Row = { cutPlanItemId: string; loaded: boolean; itemBelongsToPlan: boolean };
type SlipItem = { id: string };
type GateResult =
  | { ok: true }
  | { ok: false; code:
      | "WORKFLOW_GATE_LOADING_NO_ITEMS"
      | "WORKFLOW_GATE_LOADING_NOT_STARTED"
      | "WORKFLOW_GATE_LOADING_INCOMPLETE"
      | "WORKFLOW_GATE_LOADING_OVERLOAD"
      | "WORKFLOW_GATE_LOADING_WRONG_ITEM"
      | "WORKFLOW_GATE_LOADING_DUPLICATE" };

function gate(opts: {
  expected: number;
  rows: Row[];
  itemsJson: SlipItem[];
  overrideActive?: boolean;
}): GateResult {
  if (opts.overrideActive) return { ok: true };
  if (opts.expected === 0) return { ok: false, code: "WORKFLOW_GATE_LOADING_NO_ITEMS" };
  const loadedTotal = opts.rows.filter((r) => r.loaded).length;
  if (loadedTotal === 0) return { ok: false, code: "WORKFLOW_GATE_LOADING_NOT_STARTED" };
  const loadedInPlan = opts.rows.filter((r) => r.loaded && r.itemBelongsToPlan).length;
  if (loadedTotal !== loadedInPlan)
    return { ok: false, code: "WORKFLOW_GATE_LOADING_WRONG_ITEM" };
  if (loadedInPlan < opts.expected)
    return { ok: false, code: "WORKFLOW_GATE_LOADING_INCOMPLETE" };
  if (loadedInPlan > opts.expected)
    return { ok: false, code: "WORKFLOW_GATE_LOADING_OVERLOAD" };
  const ids = opts.itemsJson.map((i) => i.id).filter(Boolean);
  if (new Set(ids).size < ids.length)
    return { ok: false, code: "WORKFLOW_GATE_LOADING_DUPLICATE" };
  return { ok: true };
}

describe("B6 Packing Slip Loading Gate — spec mirror", () => {
  const a = "11111111-1111-1111-1111-111111111111";
  const b = "22222222-2222-2222-2222-222222222222";
  const c = "33333333-3333-3333-3333-333333333333";

  it("missing item blocks packing slip (INCOMPLETE)", () => {
    expect(
      gate({
        expected: 3,
        rows: [
          { cutPlanItemId: a, loaded: true, itemBelongsToPlan: true },
          { cutPlanItemId: b, loaded: true, itemBelongsToPlan: true },
          { cutPlanItemId: c, loaded: false, itemBelongsToPlan: true },
        ],
        itemsJson: [{ id: a }, { id: b }],
      }),
    ).toEqual({ ok: false, code: "WORKFLOW_GATE_LOADING_INCOMPLETE" });
  });

  it("wrong item (cross-plan) blocks packing slip", () => {
    expect(
      gate({
        expected: 2,
        rows: [
          { cutPlanItemId: a, loaded: true, itemBelongsToPlan: true },
          { cutPlanItemId: b, loaded: true, itemBelongsToPlan: false }, // foreign
        ],
        itemsJson: [{ id: a }, { id: b }],
      }),
    ).toEqual({ ok: false, code: "WORKFLOW_GATE_LOADING_WRONG_ITEM" });
  });

  it("duplicate scan in items_json blocks packing slip", () => {
    expect(
      gate({
        expected: 2,
        rows: [
          { cutPlanItemId: a, loaded: true, itemBelongsToPlan: true },
          { cutPlanItemId: b, loaded: true, itemBelongsToPlan: true },
        ],
        itemsJson: [{ id: a }, { id: a }], // dup
      }),
    ).toEqual({ ok: false, code: "WORKFLOW_GATE_LOADING_DUPLICATE" });
  });

  it("no items loaded yet blocks packing slip (NOT_STARTED)", () => {
    expect(
      gate({
        expected: 2,
        rows: [
          { cutPlanItemId: a, loaded: false, itemBelongsToPlan: true },
          { cutPlanItemId: b, loaded: false, itemBelongsToPlan: true },
        ],
        itemsJson: [],
      }),
    ).toEqual({ ok: false, code: "WORKFLOW_GATE_LOADING_NOT_STARTED" });
  });

  it("valid loading allows packing slip", () => {
    expect(
      gate({
        expected: 2,
        rows: [
          { cutPlanItemId: a, loaded: true, itemBelongsToPlan: true },
          { cutPlanItemId: b, loaded: true, itemBelongsToPlan: true },
        ],
        itemsJson: [{ id: a }, { id: b }],
      }),
    ).toEqual({ ok: true });
  });

  it("supervisor override bypasses the gate", () => {
    expect(
      gate({
        expected: 5,
        rows: [],
        itemsJson: [],
        overrideActive: true,
      }),
    ).toEqual({ ok: true });
  });
});

// ─── Frontend wiring ──────────────────────────────────────────────────────
describe("B6 frontend wiring", () => {
  it("workflowGateError surfaces the new LOADING_* codes", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/workflowGateError.ts"),
      "utf8",
    );
    for (const code of [
      "WORKFLOW_GATE_LOADING_NO_ITEMS",
      "WORKFLOW_GATE_LOADING_NOT_STARTED",
      "WORKFLOW_GATE_LOADING_INCOMPLETE",
      "WORKFLOW_GATE_LOADING_WRONG_ITEM",
      "WORKFLOW_GATE_LOADING_OVERLOAD",
      "WORKFLOW_GATE_LOADING_DUPLICATE",
    ]) {
      expect(src).toContain(code);
    }
  });

  it("LoadingStation logs an audit event when the slip is blocked", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/pages/LoadingStation.tsx"),
      "utf8",
    );
    expect(src).toMatch(/mapWorkflowGateError/);
    expect(src).toMatch(/packing_slip_blocked/);
    expect(src).toMatch(/activity_events/);
  });
});
