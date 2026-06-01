// Regression: Auto Clearance must NOT unlock product photo until the tag
// photo is persisted on the SAME clearance_evidence row.
//
// This locks down three structural invariants in source so future refactors
// cannot regress to the "product photo without tag photo" failure mode:
//
//   1. useAutoClearance imports and calls assertTagEvidenceReady from the
//      shared gate module (no inline checks).
//   2. handleProductCapture calls assertTagEvidenceReady BEFORE uploading the
//      product photo or updating material_photo_url.
//   3. finalizeVerification calls assertEvidenceComplete BEFORE flipping the
//      row to status='cleared'.
//   4. AutoClearanceMode disables the camera shutter while product mode is
//      locked (productLocked).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const hookSrc = readFileSync(
  resolve(__dirname, "../../../src/hooks/useAutoClearance.ts"),
  "utf8",
);
const uiSrc = readFileSync(
  resolve(__dirname, "../../../src/components/clearance/AutoClearanceMode.tsx"),
  "utf8",
);
const gateSrc = readFileSync(
  resolve(__dirname, "../../../src/lib/clearanceEvidenceGate.ts"),
  "utf8",
);

describe("Auto Clearance — tag-before-product gate", () => {
  it("imports the shared gate module (no inline reimplementations)", () => {
    expect(hookSrc).toMatch(/from\s+["']@\/lib\/clearanceEvidenceGate["']/);
    expect(hookSrc).toContain("assertTagEvidenceReady");
    expect(hookSrc).toContain("assertEvidenceComplete");
  });

  it("calls assertTagEvidenceReady before product upload in handleProductCapture", () => {
    const start = hookSrc.indexOf("const handleProductCapture");
    expect(start).toBeGreaterThan(-1);
    const fn = hookSrc.slice(start, start + 4000);
    const gateIdx = fn.indexOf("assertTagEvidenceReady");
    const uploadIdx = fn.indexOf('uploadToStorage(activeItemId, "product"');
    const materialUpdIdx = fn.indexOf("material_photo_url");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(uploadIdx).toBeGreaterThan(-1);
    expect(materialUpdIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(uploadIdx);
    expect(gateIdx).toBeLessThan(materialUpdIdx);
  });

  it("calls assertEvidenceComplete before flipping status to cleared", () => {
    const start = hookSrc.indexOf("const finalizeVerification");
    expect(start).toBeGreaterThan(-1);
    const fn = hookSrc.slice(start, start + 2000);
    const gateIdx = fn.indexOf("assertEvidenceComplete");
    const clearedIdx = fn.indexOf('status: "cleared"');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(clearedIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(clearedIdx);
  });

  it("clears active evidence refs on every fresh tag scan and on tag failure", () => {
    const tagStart = hookSrc.indexOf("const handleTagCapture");
    const tagEnd = hookSrc.indexOf("const confirmPick");
    const tagFn = hookSrc.slice(tagStart, tagEnd);
    // Top-of-cycle reset (prevents stale id from a prior aborted cycle).
    const resetIdx = tagFn.indexOf("setActiveItemId(null)");
    const stateAdvanceIdx = tagFn.indexOf('setState("tag_uploading")');
    expect(resetIdx).toBeGreaterThan(-1);
    expect(stateAdvanceIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeLessThan(stateAdvanceIdx);
    // Catch-block reset (so a failed tag can't leak ids to the next shutter).
    expect(tagFn).toMatch(/catch[\s\S]{0,200}setActiveEvidenceId\(null\)/);
  });

  it("UI disables the camera shutter while product mode is locked", () => {
    expect(uiSrc).toContain("productLocked");
    expect(uiSrc).toMatch(/disabled=\{[^}]*productLocked[^}]*\}/);
  });

  it("gate module enforces tag_scan_url + matching cut_plan_item_id + allowed state", () => {
    expect(gateSrc).toContain("TAG_PHOTO_MISSING");
    expect(gateSrc).toContain("ITEM_MISMATCH");
    expect(gateSrc).toContain("STATE_NOT_READY");
    expect(gateSrc).toContain('tag_scanned');
    expect(gateSrc).toContain("product_captured");
    // assertEvidenceComplete must require BOTH photos.
    expect(gateSrc).toContain("PRODUCT_PHOTO_MISSING");
  });
});
