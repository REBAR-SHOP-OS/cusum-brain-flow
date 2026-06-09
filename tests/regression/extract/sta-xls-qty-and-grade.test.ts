import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "supabase/functions/extract-manifest/index.ts"),
  "utf8",
);

describe("STA.xls regression — No. Pcs qty + sheet-level Grade", () => {
  it("quantity aliases include Rebar-CAD 'NO PCS' / 'PCS' variants", () => {
    const m = src.match(/const QTY_ALIASES\s*=\s*\[([\s\S]*?)\]/);
    expect(m, "QTY_ALIASES constant missing").not.toBeNull();
    const list = m![1];
    for (const alias of ["NO PCS", "PCS", "NO OF PCS", "PIECES", "COUNT"]) {
      expect(list).toContain(`"${alias}"`);
    }
  });

  it("uses the shared QTY_ALIASES constant for both scoring and index lookup", () => {
    const occurrences = (src.match(/findHeaderIndex\([^,]+,\s*QTY_ALIASES\)/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    // The old hardcoded inline list must be gone.
    expect(src).not.toMatch(/\["QTY",\s*"QUANTITY",\s*"NO",\s*"NUMBER"\]/);
  });

  it("falls back to sheet-level 'Grade :' metadata when no Grade column exists", () => {
    expect(src).toMatch(/function\s+findSheetLevelGrade\s*\(/);
    expect(src).toMatch(/const sheetGrade\s*=\s*idx\.grade\s*<\s*0\s*\?\s*findSheetLevelGrade/);
    expect(src).toMatch(/grade:\s*textAt\(r,\s*row,\s*idx\.grade\)\s*\?\?\s*sheetGrade/);
  });
});
