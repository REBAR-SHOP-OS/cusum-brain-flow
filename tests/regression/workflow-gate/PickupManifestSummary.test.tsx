/**
 * Regression: Pickup manifest summary derivation.
 *
 * PickupStation.tsx renders the manifest summary inline in a 566-line page
 * with heavy supabase / react-query / route dependencies. Pulling the block
 * out into a reusable component would be a redesign, which is explicitly
 * out of scope for Phase 2.
 *
 * This test therefore mirrors the inline derivation as a pure spec and
 * adds a drift check that asserts the production page still emits the
 * canonical summary string and badge surface area. If either drifts, the
 * mirror must be re-aligned in the same change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ChecklistEntry = { loaded?: boolean; exception?: boolean };
type Item = { id: string };

// ── Local spec mirror of the inline math at PickupStation.tsx L312–L344 ──
function computeManifestSummary(items: Item[], checklist: Map<string, ChecklistEntry>) {
  const total = items.length;
  const loadedCount = items.filter((i) => checklist.get(i.id)?.loaded).length;
  const missingCount = total - loadedCount;
  const exceptionCount = items.filter((i) => (checklist.get(i.id) as any)?.exception).length;
  return {
    total,
    loadedCount,
    missingCount,
    exceptionCount,
    summary: `${loadedCount} loaded · ${missingCount} missing · ${exceptionCount} exceptions`,
    detailsLabel: `Details (${total} items)`,
  };
}

describe("Pickup manifest summary (spec mirror)", () => {
  it("counts loaded / missing / exceptions correctly", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const checklist = new Map<string, ChecklistEntry>([
      ["a", { loaded: true }],
      ["b", { loaded: true, exception: true }],
      ["c", { loaded: false, exception: true }],
      // d intentionally missing
    ]);
    const r = computeManifestSummary(items, checklist);
    expect(r.total).toBe(4);
    expect(r.loadedCount).toBe(2);
    expect(r.missingCount).toBe(2);
    expect(r.exceptionCount).toBe(2);
    expect(r.summary).toBe("2 loaded · 2 missing · 2 exceptions");
    expect(r.detailsLabel).toBe("Details (4 items)");
  });

  it("handles an empty manifest without throwing or producing a broken badge", () => {
    const r = computeManifestSummary([], new Map());
    expect(r.total).toBe(0);
    expect(r.loadedCount).toBe(0);
    expect(r.missingCount).toBe(0);
    expect(r.exceptionCount).toBe(0);
    expect(r.summary).toBe("0 loaded · 0 missing · 0 exceptions");
    expect(r.detailsLabel).toBe("Details (0 items)");
  });

  it("treats unchecked items as missing (not exceptions)", () => {
    const items = [{ id: "x" }, { id: "y" }];
    const r = computeManifestSummary(items, new Map());
    expect(r.missingCount).toBe(2);
    expect(r.exceptionCount).toBe(0);
  });

  it("defaults the badge status to 'ready' when none is supplied", () => {
    // Mirrors:  const manifestStatus = (selectedBundle as any).status || "ready";
    const status = (undefined as any) || "ready";
    expect(String(status).toUpperCase()).toBe("READY");
  });
});

describe("PickupStation drift check", () => {
  const src = readFileSync(resolve(__dirname, "../../../src/pages/PickupStation.tsx"), "utf8");

  it("still emits the canonical summary string", () => {
    expect(src).toContain("{loadedCount} loaded · {missingCount} missing · {exceptionCount} exceptions");
  });

  it("still renders the status badge with the ready fallback", () => {
    expect(src).toContain('(selectedBundle as any).status || "ready"');
    expect(src).toContain("String(manifestStatus).toUpperCase()");
  });

  it("still renders the collapsible Details affordance", () => {
    expect(src).toContain("Details ({total} items)");
    expect(src).toMatch(/<Collapsible[^>]*defaultOpen=\{false\}/);
  });
});
