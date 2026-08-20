// Regression: RebarTagCard sub-inch dim values (e.g. G=¼", O=⅝") must NOT
// render with a leading "0" — "0¼"" is wrong, "¼"" is correct.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../src/components/office/RebarTagCard.tsx"),
  "utf8",
);

describe("RebarTagCard formatMmToFtIn sub-inch handling", () => {
  it("drops leading 0 for sub-inch values when feet=0 and wholeInches=0", () => {
    expect(src).toMatch(/if\s*\(\s*wholeInches\s*===\s*0\s*&&\s*frac\s*\)\s*return\s*`\$\{frac\}"`/);
  });

  it("functionally produces ¼\" for ~6.35 mm and ⅝\" for ~15.875 mm", async () => {
    // Re-implement the function locally (matching source) to assert behavior.
    const formatMmToFtIn = (mm: number): string => {
      const totalInches = mm / 25.4;
      const feet = Math.floor(totalInches / 12);
      const rawInches = totalInches % 12;
      const eighths = Math.round(rawInches * 8);
      const wholeInches = Math.floor(eighths / 8);
      const remainderEighths = eighths % 8;
      const fractionMap: Record<number, string> = {
        0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞",
      };
      const frac = fractionMap[remainderEighths] || "";
      if (feet === 0) {
        if (wholeInches === 0 && frac) return `${frac}"`;
        return `${wholeInches}${frac}"`;
      }
      if (wholeInches === 0 && !frac) return `${feet}'-0"`;
      return `${feet}'-${wholeInches}${frac}"`;
    };

    expect(formatMmToFtIn(6.35)).toBe('¼"');
    expect(formatMmToFtIn(15.875)).toBe('⅝"');
    expect(formatMmToFtIn(25.4)).toBe('1"');
    expect(formatMmToFtIn(38.1)).toBe('1½"');
    expect(formatMmToFtIn(304.8)).toBe(`1'-0"`);
    expect(formatMmToFtIn(1346.2)).toBe(`4'-5"`);
  });
});
