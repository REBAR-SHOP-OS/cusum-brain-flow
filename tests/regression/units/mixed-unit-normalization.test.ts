// @vitest-environment node
/**
 * REGRESSION: Canadian imports routinely mix ft-in, inches, and mm in the
 * same sheet. `normalizeDimension` must detect each unit per row, preserve
 * the lossless source string in `display`, AND emit a canonical mm value
 * for downstream math.
 *
 * Related: mem://features/office/import-unit-detection
 */
import { describe, it, expect } from "vitest";
import { normalizeDimension, normalizeRow, formatForDisplay } from "@/lib/units/normalizeMixedUnits";

describe("units: mixed-unit normalization", () => {
  it("detects ft-in (6'6\")", () => {
    const r = normalizeDimension(`6'6"`);
    expect(r.unit).toBe("ft-in");
    expect(r.display).toBe(`6'6"`);
    expect(r.mm).toBeCloseTo(6 * 304.8 + 6 * 25.4, 4);
  });

  it("detects inches-only (49\")", () => {
    const r = normalizeDimension(`49"`);
    expect(r.unit).toBe("in");
    expect(r.display).toBe(`49"`);
    expect(r.mm).toBeCloseTo(49 * 25.4, 4);
  });

  it("detects mm bare and mm-suffixed", () => {
    const bare = normalizeDimension("1524");
    const suffixed = normalizeDimension("1524mm");
    expect(bare.unit).toBe("mm");
    expect(suffixed.unit).toBe("mm");
    expect(bare.mm).toBe(1524);
    expect(suffixed.mm).toBe(1524);
  });

  it("normalizes a mixed-unit row in one pass", () => {
    const out = normalizeRow([`6'6"`, `49"`, "1524mm", null, "junk"]);
    expect(out.map(o => o.unit)).toEqual(["ft-in", "in", "mm", "unknown", "unknown"]);
    expect(out[0].mm).toBeCloseTo(1981.2, 1);
    expect(out[1].mm).toBeCloseTo(1244.6, 1);
    expect(out[2].mm).toBe(1524);
    expect(out[3].mm).toBeNull();
    expect(out[4].mm).toBeNull();
  });

  it("formatForDisplay 'auto' returns lossless source", () => {
    const r = normalizeDimension(`6'6"`);
    expect(formatForDisplay(r, "auto")).toBe(`6'6"`);
  });

  it("formatForDisplay 'mm' converts without mutating source", () => {
    const r = normalizeDimension(`49"`);
    expect(formatForDisplay(r, "mm")).toBe(`1245mm`);
    expect(r.display).toBe(`49"`); // source untouched
  });

  it("formatForDisplay 'ft-in' round-trips reasonably", () => {
    const r = normalizeDimension("1524mm");
    // 1524mm = 60in = 5'0"
    expect(formatForDisplay(r, "ft-in")).toBe(`5'`);
  });
});