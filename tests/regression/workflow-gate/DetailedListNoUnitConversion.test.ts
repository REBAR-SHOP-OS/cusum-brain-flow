// @vitest-environment node
// Regression: Detailed List edit MUST NOT convert user input to mm.
// The cut_length_mm column is misnamed — for imperial rows it holds the source
// unit (inches) as-is, and bend_dimensions follows the same convention.
// Converting on edit/save corrupts the data (e.g. 6" → 0.24).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(process.cwd(), "src/components/office/DetailedListView.tsx"),
  "utf8",
);

describe("DetailedListView — no unit conversion on edit", () => {
  it("does not import displayModeToMm or LengthDisplayMode", () => {
    expect(src).not.toMatch(/displayModeToMm/);
    expect(src).not.toMatch(/LengthDisplayMode/);
  });

  it("does not define or call an mmToEditUnit helper", () => {
    expect(src).not.toMatch(/mmToEditUnit/);
  });

  it("does not divide by 25.4 or 304.8 in the edit path", () => {
    expect(src).not.toMatch(/\/\s*25\.4/);
    expect(src).not.toMatch(/\/\s*304\.8/);
  });

  it("uses parseFloat with step=\"any\" on length and dim inputs", () => {
    // length input
    expect(src).toMatch(/cut_length_mm:\s*parseFloat\(/);
    // dim input
    expect(src).toMatch(/bend_dimensions:[\s\S]{0,200}parseFloat\(/);
    // both number inputs accept decimals
    const stepAnyCount = (src.match(/step="any"/g) || []).length;
    expect(stepAnyCount).toBeGreaterThanOrEqual(2);
  });
});
