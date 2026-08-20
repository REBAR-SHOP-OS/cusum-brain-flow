/**
 * Regression: WORKFLOW_GATE_* pass-through helper.
 *
 * The production implementation lives in
 *   supabase/functions/_shared/requestHandler.ts → mapWorkflowGateError
 * That file imports remote `https://esm.sh/...` URLs intended for the Deno
 * edge runtime, so it cannot be imported directly under Vite/Vitest.
 *
 * This suite uses two layers of protection:
 *   1. A local spec-mirror of mapWorkflowGateError (identical branches) is
 *      unit-tested against Postgres-shaped error objects. If the production
 *      behaviour changes, this mirror must change too — and the drift check
 *      below will fail until the two are reconciled.
 *   2. A drift check reads the production source as text and asserts the
 *      canonical regex + SQLSTATE list are still present verbatim. This
 *      catches accidental rewrites of the production helper.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Local spec-mirror of supabase/functions/_shared/requestHandler.ts ──
function mapWorkflowGateError(
  err: unknown,
): { code: string; error: string } | null {
  if (!err) return null;
  const e = err as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : String(err ?? "");
  const sqlState = typeof e.code === "string" ? e.code : "";

  const match = message.match(/(WORKFLOW_(?:GATE|OVERRIDE)_[A-Z0-9_]+)/);
  if (match) return { code: match[1], error: message };

  if (
    ["P0001", "42501", "22023", "28000", "02000"].includes(sqlState) &&
    /workflow/i.test(message)
  ) {
    return { code: `WORKFLOW_GATE_${sqlState}`, error: message };
  }
  return null;
}

describe("mapWorkflowGateError (spec mirror)", () => {
  it("extracts WORKFLOW_GATE_ADJACENCY from a trigger raise", () => {
    const err = {
      message: "WORKFLOW_GATE_ADJACENCY: cut_plans draft → completed not allowed",
      code: "P0001",
    };
    expect(mapWorkflowGateError(err)).toEqual({
      code: "WORKFLOW_GATE_ADJACENCY",
      error: err.message,
    });
  });

  it("extracts WORKFLOW_OVERRIDE_REQUIRED", () => {
    const err = {
      message: "WORKFLOW_OVERRIDE_REQUIRED: supervisor reason missing",
      code: "P0001",
    };
    expect(mapWorkflowGateError(err)?.code).toBe("WORKFLOW_OVERRIDE_REQUIRED");
  });

  it("falls back to WORKFLOW_GATE_<sqlstate> when message wraps a workflow error", () => {
    const err = {
      message: "database error: workflow rule violated",
      code: "P0001",
    };
    expect(mapWorkflowGateError(err)).toEqual({
      code: "WORKFLOW_GATE_P0001",
      error: err.message,
    });
  });

  it("returns null for unrelated P0001 raises (no false positive)", () => {
    const err = { message: "duplicate key value violates unique constraint", code: "P0001" };
    expect(mapWorkflowGateError(err)).toBeNull();
  });

  it("returns null for nullish / non-error inputs", () => {
    expect(mapWorkflowGateError(null)).toBeNull();
    expect(mapWorkflowGateError(undefined)).toBeNull();
    expect(mapWorkflowGateError("some string")).toBeNull();
  });

  it("returns null for a plain Error with no SQLSTATE and no workflow token", () => {
    expect(mapWorkflowGateError(new Error("network blip"))).toBeNull();
  });

  it("accepts other recognised SQLSTATEs (42501, 22023, 28000, 02000) when message mentions workflow", () => {
    for (const code of ["42501", "22023", "28000", "02000"]) {
      const r = mapWorkflowGateError({ message: "workflow check failed", code });
      expect(r?.code).toBe(`WORKFLOW_GATE_${code}`);
    }
  });
});

describe("mapWorkflowGateError drift check", () => {
  it("production source still contains the canonical regex and SQLSTATE list", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../supabase/functions/_shared/requestHandler.ts"),
      "utf8",
    );
    expect(src).toContain(`/(WORKFLOW_(?:GATE|OVERRIDE)_[A-Z0-9_]+)/`);
    expect(src).toContain(`["P0001", "42501", "22023", "28000", "02000"]`);
    expect(src).toMatch(/export function mapWorkflowGateError/);
  });
});
