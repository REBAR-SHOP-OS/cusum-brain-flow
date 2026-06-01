/**
 * Regression: Clearance Station must enforce strict MARK + DWG + Ref matching
 * and zone gating in the camera/match pipeline.
 *
 * - match-tag-photo edge function must score DWG and Ref alongside MARK, and
 *   must NOT auto-clear on MARK alone.
 * - useAutoClearance must pass drawing_ref / ref_no / storage_zone in the
 *   candidate payload and must read selectedZone.
 * - ClearanceStation must block Auto/Manual buttons until a zone is selected.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("Clearance Station strict 3-field match + zone gate", () => {
  const matcher = read("supabase/functions/match-tag-photo/index.ts");
  const hook = read("src/hooks/useAutoClearance.ts");
  const station = read("src/pages/ClearanceStation.tsx");
  const data = read("src/hooks/useClearanceData.ts");

  it("OCR schema asks the model for dwg and ref fields", () => {
    expect(matcher).toMatch(/dwg:\s*\{\s*type:\s*'string'/);
    expect(matcher).toMatch(/ref:\s*\{\s*type:\s*'string'/);
  });

  it("auto decision requires unique MARK + DWG + Ref exact match", () => {
    expect(matcher).toMatch(/strictHits/);
    expect(matcher).toMatch(/markExact\s*&&\s*s\.dwgExact\s*&&\s*s\.refExact/);
    expect(matcher).toMatch(/unique MARK\+DWG\+Ref exact/);
  });

  it("MARK-only matches degrade to 'confirm' with a mismatch reason", () => {
    expect(matcher).toMatch(/MARK matched, but/);
    // No more "unique MARK exact" auto path that ignores DWG/Ref.
    expect(matcher).not.toMatch(/decision\s*=\s*'auto';\s*reason\s*=\s*'unique MARK exact'/);
  });

  it("candidates include drawing_ref, ref_no, and storage_zone", () => {
    expect(hook).toMatch(/drawing_ref:\s*i\.drawing_ref/);
    expect(hook).toMatch(/ref_no:\s*i\.ref_no/);
    expect(hook).toMatch(/storage_zone:\s*i\.storage_zone/);
  });

  it("useAutoClearance accepts selectedZone and blocks cross-zone matches", () => {
    expect(hook).toMatch(/selectedZone\?:\s*string\s*\|\s*null/);
    expect(hook).toMatch(/Tag belongs to a different zone/);
  });

  it("evidence row is written with ocr_/matched_ fields and mismatch_reason", () => {
    expect(hook).toMatch(/ocr_mark:/);
    expect(hook).toMatch(/ocr_dwg:/);
    expect(hook).toMatch(/ocr_ref:/);
    expect(hook).toMatch(/matched_mark:/);
    expect(hook).toMatch(/matched_dwg:/);
    expect(hook).toMatch(/matched_ref:/);
    expect(hook).toMatch(/mismatch_reason:/);
  });

  it("ClearanceItem exposes ref_no to the UI", () => {
    expect(data).toMatch(/ref_no:\s*string\s*\|\s*null/);
    expect(data).toMatch(/ref_no:\s*item\.ref_no/);
  });

  it("Manual and Auto Clearance buttons are disabled until zone is selected", () => {
    expect(station).toMatch(/Select zone before clearance/);
    expect(station).toMatch(/disabled=\{!manifestZone\}/);
    expect(station).toMatch(/autoMode\s*&&\s*canWrite\s*&&\s*manifestZone/);
  });

  it("Zone change while in auto mode requires confirmation", () => {
    expect(station).toMatch(/Changing zone will reset current clearance session view/);
  });
});
