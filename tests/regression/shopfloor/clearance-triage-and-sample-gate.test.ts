// @vitest-environment node
// Regression: Clearance Station live-health pill, sample toggle/gating,
// triage breakdown badges, urgency sort, and evidence-gated manual clear.
//
// Source-level guards so future refactors cannot regress the audit upgrades.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const hook = read("src/hooks/useClearanceData.ts");
const page = read("src/pages/ClearanceStation.tsx");
const card = read("src/components/clearance/ClearanceCard.tsx");

describe("Clearance audit upgrades", () => {
  describe("useClearanceData derivations", () => {
    it("exports isSampleLabel heuristic covering sample/demo/test/seed", () => {
      expect(hook).toMatch(/export function isSampleLabel/);
      expect(hook).toMatch(/sample\|demo\|test\|seed/);
    });

    it("derives triage bucket, urgency, is_sample on every row", () => {
      expect(hook).toMatch(/is_sample:\s*boolean/);
      expect(hook).toMatch(/triage:\s*"cleared"\s*\|\s*"needs_fix"\s*\|\s*"stale"\s*\|\s*"upstream_not_ready"\s*\|\s*"pending"/);
      expect(hook).toMatch(/urgency:\s*number/);
      // Mismatch / manual_review → needs_fix
      expect(hook).toMatch(/mismatch_reason\s*\|\|\s*verification_state\s*===\s*"manual_review"/);
      // Stale threshold defined
      expect(hook).toMatch(/STALE_HOURS\s*=\s*24/);
    });

    it("returns liveItems, sampleItems, hasLive, triageCounts, dataUpdatedAt", () => {
      expect(hook).toMatch(/liveItems,/);
      expect(hook).toMatch(/sampleItems,/);
      expect(hook).toMatch(/hasLive,/);
      expect(hook).toMatch(/triageCounts,/);
      expect(hook).toMatch(/dataUpdatedAt,/);
      // Counts must include all 5 buckets
      for (const k of ["pending", "cleared", "needs_fix", "upstream_not_ready", "stale"]) {
        expect(hook).toContain(k);
      }
    });
  });

  describe("ClearanceStation UI gates", () => {
    it("renders live-data health pill with live/stale/offline branches", () => {
      expect(page).toMatch(/clearance-health-pill/);
      expect(page).toMatch(/health\s*===\s*"live"/);
      expect(page).toMatch(/health\s*===\s*"stale"/);
      expect(page).toMatch(/health\s*===\s*"offline"/);
    });

    it("renders triage breakdown badges for all 5 buckets", () => {
      expect(page).toMatch(/data-testid="triage-badges"/);
      expect(page).toMatch(/triageCounts\.needs_fix/);
      expect(page).toMatch(/triageCounts\.stale/);
      expect(page).toMatch(/triageCounts\.upstream_not_ready/);
      expect(page).toMatch(/triageCounts\.pending/);
      expect(page).toMatch(/triageCounts\.cleared/);
    });

    it("samples are hidden by default and toggle is forced on when no live data", () => {
      expect(page).toMatch(/samplesVisible\s*=\s*showSamples\s*\|\|\s*!hasLive/);
      expect(page).toMatch(/g\.items\.some\(\(i\)\s*=>\s*!i\.is_sample\)/);
    });

    it("sample rows pass canWrite={canWrite && !item.is_sample} so manual clear is disabled", () => {
      expect(page).toMatch(/canWrite=\{canWrite\s*&&\s*!item\.is_sample\}/);
    });

    it("Auto Clearance button blocks all-sample manifests", () => {
      expect(page).toMatch(/pendingItems\.every\(\(i\)\s*=>\s*i\.is_sample\)/);
      expect(page).toMatch(/Sample manifest — Auto Clearance disabled/);
    });

    it("activeItems are sorted by urgency desc then oldest first", () => {
      // urgency desc
      expect(page).toMatch(/b\.urgency\s*-\s*a\.urgency/);
      // oldest-first tiebreak inside same sort
      const sortStart = page.indexOf("const activeItems = useMemo");
      const sortEnd = page.indexOf("}, [items, selectedProjectKey]);", sortStart);
      const block = page.slice(sortStart, sortEnd);
      expect(block).toMatch(/return ta - tb/);
    });
  });

  describe("Evidence-gated manual clear (already enforced — locked here)", () => {
    it("ClearanceCard still calls assertEvidenceComplete before status:'cleared'", () => {
      const gateIdx = card.indexOf("assertEvidenceComplete(item.evidence_id, item.id)");
      const clearedIdx = card.indexOf('status: "cleared"');
      expect(gateIdx).toBeGreaterThan(-1);
      expect(clearedIdx).toBeGreaterThan(-1);
      expect(gateIdx).toBeLessThan(clearedIdx);
    });
  });
});
