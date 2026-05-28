// @vitest-environment node
// Regression: Auto Clearance must never advance to product capture / finalize
// when the tag photo is missing from the SAME clearance_evidence row.
//
// Repro of the previously-failing path:
//   1. operator captures tag (medium confidence → confirm pick)
//   2. confirmPick used to set verification_state='tag_scanned' WITHOUT
//      uploading the tag blob → tag_scan_url stayed NULL
//   3. UI moved to waiting_product, operator shot product photo
//   4. evidence row ended with product_photo but no tag_photo
//
// The shared gate `assertTagEvidenceReady` and `assertEvidenceComplete` in
// `src/lib/clearanceEvidenceGate.ts` block this. Tests below pin the contract.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const state: { row: any } = { row: null };
  const builder = () => ({
    select: () => builder(),
    eq: () => builder(),
    maybeSingle: async () => ({ data: state.row, error: null }),
  });
  return {
    __state: state,
    supabase: {
      from: () => builder(),
    },
  };
});

import {
  assertTagEvidenceReady,
  assertEvidenceComplete,
  ClearanceGateError,
} from "@/lib/clearanceEvidenceGate";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as mock from "@/integrations/supabase/client";

const setRow = (row: any) => {
  (mock as any).__state.row = row;
};

beforeEach(() => setRow(null));

describe("assertTagEvidenceReady", () => {
  it("throws TAG_PHOTO_MISSING when tag_scan_url is null", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "item1",
      tag_scan_url: null,
      verification_state: "tag_scanned",
    });
    await expect(assertTagEvidenceReady("ev1", "item1")).rejects.toMatchObject({
      code: "TAG_PHOTO_MISSING",
    });
  });

  it("throws ITEM_MISMATCH when evidence belongs to a different item", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "OTHER",
      tag_scan_url: "path/tag.jpg",
      verification_state: "tag_scanned",
    });
    await expect(assertTagEvidenceReady("ev1", "item1")).rejects.toMatchObject({
      code: "ITEM_MISMATCH",
    });
  });

  it("throws NO_EVIDENCE_ID when no evidence id supplied", async () => {
    await expect(assertTagEvidenceReady("", "item1")).rejects.toBeInstanceOf(
      ClearanceGateError,
    );
  });

  it("passes when tag photo + state present and item matches", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "item1",
      tag_scan_url: "path/tag.jpg",
      verification_state: "tag_scanned",
    });
    await expect(assertTagEvidenceReady("ev1", "item1")).resolves.toBeUndefined();
  });
});

describe("assertEvidenceComplete", () => {
  it("throws PRODUCT_PHOTO_MISSING when only tag exists", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "item1",
      tag_scan_url: "path/tag.jpg",
      material_photo_url: null,
    });
    await expect(assertEvidenceComplete("ev1", "item1")).rejects.toMatchObject({
      code: "PRODUCT_PHOTO_MISSING",
    });
  });

  it("throws TAG_PHOTO_MISSING when only product exists (bug repro)", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "item1",
      tag_scan_url: null,
      material_photo_url: "path/prod.jpg",
    });
    await expect(assertEvidenceComplete("ev1", "item1")).rejects.toMatchObject({
      code: "TAG_PHOTO_MISSING",
    });
  });

  it("passes when both photos exist on the same row for the active item", async () => {
    setRow({
      id: "ev1",
      cut_plan_item_id: "item1",
      tag_scan_url: "path/tag.jpg",
      material_photo_url: "path/prod.jpg",
    });
    await expect(assertEvidenceComplete("ev1", "item1")).resolves.toBeUndefined();
  });
});
