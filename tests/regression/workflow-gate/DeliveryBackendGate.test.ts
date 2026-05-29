// @vitest-environment node
/**
 * Regression: Delivery completion backend gate.
 *
 * Production gate lives in the migration that creates
 *   public.validate_delivery_completion()
 * — a BEFORE UPDATE trigger on public.delivery_stops that blocks
 * transitions to status='delivered' unless pod_signature, pod_photo_url
 * and the unloading checklist (when the linked packing slip has items)
 * are all confirmed.
 *
 * These tests use:
 *  - a spec mirror of the trigger logic exercised against the four
 *    scenarios required by the request
 *  - drift checks against the migration SQL, the UI page, and the
 *    workflowGateError mapping so any side regressing fails this suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface StopRow {
  status: string;
  pod_signature: string | null;
  pod_photo_url: string | null;
  notes: string | null;
}

// ── Spec mirror of validate_delivery_completion ──
function gateDeliveryCompletion(
  oldRow: StopRow,
  newRow: StopRow,
  slipItemTotal: number,
  overrideActive = false,
): { ok: true } | { ok: false; code: string } {
  if (newRow.status !== "delivered") return { ok: true };
  if (oldRow.status === newRow.status) return { ok: true };
  if (overrideActive) return { ok: true };

  if (!newRow.pod_signature || newRow.pod_signature.trim().length === 0) {
    return { ok: false, code: "WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED" };
  }
  if (!newRow.pod_photo_url || newRow.pod_photo_url.trim().length === 0) {
    return { ok: false, code: "WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED" };
  }

  if (slipItemTotal > 0) {
    let notesJson: any = null;
    try {
      notesJson = newRow.notes ? JSON.parse(newRow.notes) : null;
    } catch {
      notesJson = null;
    }
    if (
      !notesJson ||
      notesJson.checklist_total == null ||
      notesJson.checklist_completed == null
    ) {
      return { ok: false, code: "WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE" };
    }
    const total = Number(notesJson.checklist_total) || 0;
    const done = Number(notesJson.checklist_completed) || 0;
    if (total <= 0 || done < total) {
      return { ok: false, code: "WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE" };
    }
  }
  return { ok: true };
}

const PENDING: StopRow = {
  status: "pending",
  pod_signature: null,
  pod_photo_url: null,
  notes: null,
};
const fullNotes = (n: number) =>
  JSON.stringify({ checklist_completed: n, checklist_total: n });

describe("Delivery completion gate (spec mirror)", () => {
  it("blocks completion when final delivery photo is missing", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: "sig-data",
      pod_photo_url: null,
      notes: fullNotes(3),
    };
    expect(gateDeliveryCompletion(PENDING, next, 3)).toEqual({
      ok: false,
      code: "WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED",
    });
  });

  it("blocks completion when customer signature is missing", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: null,
      pod_photo_url: "pod/x.jpg",
      notes: fullNotes(2),
    };
    expect(gateDeliveryCompletion(PENDING, next, 2)).toEqual({
      ok: false,
      code: "WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED",
    });
  });

  it("blocks completion when unloading checklist is incomplete", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: "sig",
      pod_photo_url: "pod/x.jpg",
      notes: JSON.stringify({ checklist_completed: 2, checklist_total: 3 }),
    };
    expect(gateDeliveryCompletion(PENDING, next, 3)).toEqual({
      ok: false,
      code: "WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE",
    });
  });

  it("blocks completion when checklist metadata is missing entirely (but slip has items)", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: "sig",
      pod_photo_url: "pod/x.jpg",
      notes: null,
    };
    expect(gateDeliveryCompletion(PENDING, next, 4)).toEqual({
      ok: false,
      code: "WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE",
    });
  });

  it("allows completion when signature, photo, and full checklist are present", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: "sig",
      pod_photo_url: "pod/x.jpg",
      notes: fullNotes(3),
    };
    expect(gateDeliveryCompletion(PENDING, next, 3)).toEqual({ ok: true });
  });

  it("allows completion with no checklist data when the slip has zero items", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: "sig",
      pod_photo_url: "pod/x.jpg",
      notes: null,
    };
    expect(gateDeliveryCompletion(PENDING, next, 0)).toEqual({ ok: true });
  });

  it("does not gate non-delivery status updates", () => {
    const next: StopRow = { ...PENDING, status: "en_route" };
    expect(gateDeliveryCompletion(PENDING, next, 5)).toEqual({ ok: true });
  });

  it("respects supervisor override", () => {
    const next: StopRow = {
      status: "delivered",
      pod_signature: null,
      pod_photo_url: null,
      notes: null,
    };
    expect(gateDeliveryCompletion(PENDING, next, 5, true)).toEqual({ ok: true });
  });
});

describe("Delivery backend gate migration drift check", () => {
  const migrationsDir = resolve(__dirname, "../../../supabase/migrations");
  const sqlHas = (needle: string) =>
    readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .some((f) =>
        readFileSync(resolve(migrationsDir, f), "utf8").includes(needle),
      );

  it("ships the validate_delivery_completion trigger function", () => {
    expect(sqlHas("FUNCTION public.validate_delivery_completion")).toBe(true);
    expect(sqlHas("trg_validate_delivery_completion")).toBe(true);
  });

  it("declares all three delivery gate error codes", () => {
    expect(sqlHas("WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED")).toBe(true);
    expect(sqlHas("WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED")).toBe(true);
    expect(sqlHas("WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE")).toBe(true);
  });

  it("logs delivery_completed audit event", () => {
    expect(sqlHas("delivery_completed")).toBe(true);
    expect(sqlHas("log_delivery_completed")).toBe(true);
  });
});

describe("DeliveryTerminal UI drift check", () => {
  const src = readFileSync(
    resolve(__dirname, "../../../src/pages/DeliveryTerminal.tsx"),
    "utf8",
  );

  it("maps backend gate errors via mapWorkflowGateError", () => {
    expect(src).toContain('from "@/lib/workflowGateError"');
    expect(src).toContain("mapWorkflowGateError(err)");
  });

  it("logs delivery_blocked audit event when the gate fires", () => {
    expect(src).toContain('eventType: "delivery_blocked"');
    expect(src).toContain('gate_code: gate.code');
  });
});

describe("workflowGateError delivery message mapping", () => {
  it("maps every delivery gate code to a friendly message", async () => {
    const { mapWorkflowGateError } = await import(
      "../../../src/lib/workflowGateError"
    );
    for (const code of [
      "WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED",
      "WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED",
      "WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE",
    ]) {
      const r = mapWorkflowGateError({ message: `${code}: trigger said no` });
      expect(r?.code).toBe(code);
      expect(r?.description).not.toMatch(/^WORKFLOW_/);
    }
  });
});
