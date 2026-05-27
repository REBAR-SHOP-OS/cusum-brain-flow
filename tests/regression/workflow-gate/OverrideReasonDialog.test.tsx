/**
 * Regression: OverrideReasonDialog contract.
 *
 * The production component lives at
 *   src/components/shopfloor/OverrideReasonDialog.tsx
 * and is rendered inside the Clearance card on `/shopfloor/station`.
 *
 * The repo's React Testing Library setup is currently wedged on a missing
 * `canvas.node` native binding pulled in by jsdom — this affects every
 * `.test.tsx` file in the project, not just this one, and fixing it is
 * out of scope for the Phase 2 surgical pass.
 *
 * To still guarantee the dialog's contract does not silently drift, this
 * suite combines:
 *   1. Direct unit tests on the component's RPC payload shape, exercised
 *      via a tiny pure helper that mirrors lines 56–82 of the component.
 *   2. Drift checks that read the production .tsx as text and assert the
 *      canonical surface area (RPC name, arg keys, 10-char gate, role
 *      check, workflow_overrides reference) is still present verbatim.
 *
 * If either layer fails, the component and this test must be brought back
 * into agreement in the same change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Spec mirror of the RPC invocation at OverrideReasonDialog.tsx L56–L82 ──
function buildOverrideRpcArgs(input: {
  entityType: "cut_plan_item" | "bundle" | "cut_plan" | "clearance_evidence";
  entityId: string;
  toState: string;
  reason: string;
}) {
  const trimmed = input.reason.trim();
  if (trimmed.length < 10) return null;
  return {
    _entity_type: input.entityType,
    _entity_id: input.entityId,
    _to_state: input.toState,
    _reason: trimmed,
  };
}

function canOverride(role: { isAdmin?: boolean; isShopSupervisor?: boolean }) {
  return Boolean(role.isAdmin || role.isShopSupervisor);
}

describe("OverrideReasonDialog (spec mirror)", () => {
  it("returns null args when reason is below the 10-char floor", () => {
    expect(buildOverrideRpcArgs({
      entityType: "cut_plan_item",
      entityId: "i1",
      toState: "clearance",
      reason: "too short",
    })).toBeNull();
  });

  it("treats whitespace-only reasons as too short", () => {
    expect(buildOverrideRpcArgs({
      entityType: "cut_plan_item",
      entityId: "i1",
      toState: "clearance",
      reason: "            ",
    })).toBeNull();
  });

  it("trims surrounding whitespace and forwards the canonical RPC args", () => {
    const args = buildOverrideRpcArgs({
      entityType: "cut_plan_item",
      entityId: "item-123",
      toState: "clearance",
      reason: "   stuck adjacency from cutting → clearance   ",
    });
    expect(args).toEqual({
      _entity_type: "cut_plan_item",
      _entity_id: "item-123",
      _to_state: "clearance",
      _reason: "stuck adjacency from cutting → clearance",
    });
  });

  it("accepts every supported entity type", () => {
    for (const t of ["cut_plan_item", "bundle", "cut_plan", "clearance_evidence"] as const) {
      const args = buildOverrideRpcArgs({
        entityType: t,
        entityId: "abc",
        toState: "complete",
        reason: "valid reason string",
      });
      expect(args?._entity_type).toBe(t);
    }
  });

  it("only admin or shop_supervisor may issue an override", () => {
    expect(canOverride({ isAdmin: true })).toBe(true);
    expect(canOverride({ isShopSupervisor: true })).toBe(true);
    expect(canOverride({ isAdmin: false, isShopSupervisor: false })).toBe(false);
    expect(canOverride({})).toBe(false);
  });
});

describe("OverrideReasonDialog drift check", () => {
  const src = readFileSync(
    resolve(__dirname, "../../../src/components/shopfloor/OverrideReasonDialog.tsx"),
    "utf8",
  );

  it("still calls the workflow_override_transition RPC", () => {
    expect(src).toContain(`supabase.rpc(`);
    expect(src).toContain(`"workflow_override_transition"`);
  });

  it("still forwards _entity_type / _entity_id / _to_state / _reason", () => {
    expect(src).toContain("_entity_type:");
    expect(src).toContain("_entity_id:");
    expect(src).toContain("_to_state:");
    expect(src).toContain("_reason:");
  });

  it("still enforces the 10-char reason floor on the client", () => {
    expect(src).toMatch(/trimmed\.length\s*<\s*10/);
  });

  it("still gates the action behind admin or shop_supervisor", () => {
    expect(src).toContain("isAdmin || isShopSupervisor");
  });

  it("still references the workflow_overrides audit log in the description", () => {
    expect(src).toContain("workflow_overrides");
  });
});
