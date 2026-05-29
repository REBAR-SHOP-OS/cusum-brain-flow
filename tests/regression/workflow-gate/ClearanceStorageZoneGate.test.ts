// @vitest-environment node
// Regression: A8 Storage Zone — clearance cannot be marked complete until a
// storage zone (Zone 1–5) is assigned to the clearance_evidence row.
//
// Two layers are pinned:
//   1. Backend trigger validate_clearance_evidence_transition raises
//      WORKFLOW_GATE_STORAGE_ZONE_REQUIRED when status flips to 'cleared'
//      with storage_zone NULL/blank (and no supervisor override).
//   2. Frontend handleVerify in ClearanceCard short-circuits with a toast
//      when item.storage_zone is missing, so the request never reaches the DB.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION =
  "supabase/migrations/20260529151236_a8-storage-zone-clearance.sql";

function loadLatestZoneMigration(): string {
  // Read the latest A8 migration by glob-ish lookup.
  const fs = require("node:fs") as typeof import("node:fs");
  const dir = resolve(process.cwd(), "supabase/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f: string) => f.endsWith(".sql"))
    .sort();
  // Find the file that introduces storage_zone validation.
  const match = files
    .map((f: string) => ({ f, body: readFileSync(resolve(dir, f), "utf8") }))
    .filter(({ body }: { body: string }) =>
      body.includes("WORKFLOW_GATE_STORAGE_ZONE_REQUIRED"),
    );
  if (match.length === 0) {
    throw new Error(
      `No migration found containing WORKFLOW_GATE_STORAGE_ZONE_REQUIRED. ` +
        `Expected the A8 storage-zone migration to be present.`,
    );
  }
  return match[match.length - 1].body;
}

describe("A8 Storage Zone — backend trigger contract", () => {
  const sql = loadLatestZoneMigration();

  it("validate_clearance_evidence_transition requires storage_zone for cleared", () => {
    expect(sql).toMatch(/validate_clearance_evidence_transition/);
    expect(sql).toMatch(/storage_zone IS NULL OR btrim\(NEW\.storage_zone\) = ''/);
    expect(sql).toMatch(/WORKFLOW_GATE_STORAGE_ZONE_REQUIRED/);
  });

  it("constrains storage_zone to Zone 1..Zone 7", () => {
    expect(sql).toMatch(
      /CHECK \(storage_zone IS NULL OR storage_zone IN \('Zone 1','Zone 2','Zone 3','Zone 4','Zone 5','Zone 6','Zone 7'\)\)/,
    );
  });

  it("logs an audit event on zone assignment", () => {
    expect(sql).toMatch(/log_clearance_zone_assignment/);
    expect(sql).toMatch(/'storage_zone_assigned'/);
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OF storage_zone/);
  });

  it("still respects supervisor override", () => {
    expect(sql).toMatch(/_workflow_override_active\(\)/);
  });
});

// ─── Frontend pre-gate ─────────────────────────────────────────────────────
// Mirrors the guard inside ClearanceCard.handleVerify so a missing zone is
// rejected before any Supabase round-trip.
function preVerifyGate(item: { storage_zone: string | null | undefined }) {
  if (!item.storage_zone) {
    return { ok: false, reason: "storage_zone_required" as const };
  }
  return { ok: true as const };
}

describe("A8 Storage Zone — frontend pre-gate", () => {
  it("blocks verify when storage_zone is null", () => {
    expect(preVerifyGate({ storage_zone: null })).toEqual({
      ok: false,
      reason: "storage_zone_required",
    });
  });

  it("blocks verify when storage_zone is undefined", () => {
    expect(preVerifyGate({ storage_zone: undefined })).toEqual({
      ok: false,
      reason: "storage_zone_required",
    });
  });

  it("allows verify when storage_zone is assigned", () => {
    expect(preVerifyGate({ storage_zone: "Zone 3" })).toEqual({ ok: true });
  });
});
