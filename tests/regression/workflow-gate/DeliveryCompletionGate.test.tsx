/**
 * Regression: Delivery completion gate (D4/D6 fix).
 *
 * DeliveryTerminal.tsx renders the POD capture inline in a 543-line page
 * with heavy supabase / react / route dependencies. Extracting the gate
 * into a reusable helper would be a redesign, which is explicitly out of
 * scope.
 *
 * This test therefore mirrors the inline gate logic as a pure spec and
 * adds drift checks that assert the production page still enforces the
 * three required conditions. If the page drifts, the mirror must be
 * re-aligned in the same change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ChecklistItem {
  checked?: boolean;
}

// ── Local spec mirror of the inline gate at DeliveryTerminal.tsx L227–L240 ──
function canCompleteDelivery(
  photoFile: File | null,
  signatureData: string | null,
  items: ChecklistItem[]
): { ok: boolean; reason?: string } {
  if (!photoFile || !signatureData) {
    return { ok: false, reason: "Please capture a site photo and customer signature" };
  }
  if (items.length > 0 && items.some((i) => !i.checked)) {
    return { ok: false, reason: "Please confirm all items on the unloading checklist" };
  }
  return { ok: true };
}

describe("Delivery completion gate (spec mirror)", () => {
  it("blocks completion when photo is missing", () => {
    const r = canCompleteDelivery(null, "data:image/png;base64,abc", []);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("photo");
  });

  it("blocks completion when signature is missing", () => {
    const r = canCompleteDelivery(new File([], "x.jpg"), null, []);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("signature");
  });

  it("blocks completion when checklist has unchecked items", () => {
    const items = [{ checked: true }, { checked: false }, { checked: true }];
    const r = canCompleteDelivery(new File([], "x.jpg"), "data:image/png;base64,abc", items);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("checklist");
  });

  it("allows completion when photo, signature, and all items are confirmed", () => {
    const items = [{ checked: true }, { checked: true }];
    const r = canCompleteDelivery(new File([], "x.jpg"), "data:image/png;base64,abc", items);
    expect(r.ok).toBe(true);
  });

  it("allows completion when checklist is empty (no items to confirm)", () => {
    const r = canCompleteDelivery(new File([], "x.jpg"), "data:image/png;base64,abc", []);
    expect(r.ok).toBe(true);
  });

  it("allows completion when checklist items are all explicitly checked", () => {
    const r = canCompleteDelivery(new File([], "x.jpg"), "data:image/png;base64,abc", [{ checked: true }]);
    expect(r.ok).toBe(true);
  });
});

describe("DeliveryTerminal drift check", () => {
  const src = readFileSync(resolve(__dirname, "../../../src/pages/DeliveryTerminal.tsx"), "utf8");

  it("still uses OR gate for photo + signature (not AND)", () => {
    // The D4/D6 bug was `!photoFile && !signatureData` which only blocked
    // when BOTH were missing. The fix requires `||` so either missing blocks.
    expect(src).toContain("if (!photoFile || !signatureData)");
    expect(src).not.toContain("if (!photoFile && !signatureData)");
  });

  it("still checks item checklist completeness before submit", () => {
    expect(src).toContain("items.some((i) => !i.checked)");
    expect(src).toContain("Please confirm all items on the unloading checklist");
  });

  it("disables the submit button when any gate is open", () => {
    // Button disabled prop must use the same OR logic so the UI is
    // consistent with the runtime gate.
    expect(src).toContain("disabled={saving || !photoFile || !signatureData || (items.length > 0 && items.some((i) => !i.checked))}");
  });
});
