import { describe, it, expect } from "vitest";
import { inchesToFraction } from "./fraction";

describe("inchesToFraction", () => {
  it("returns NaN for non-finite input", () => {
    expect(inchesToFraction(NaN)).toBeNaN();
    expect(inchesToFraction(Infinity)).toBeNaN();
    expect(inchesToFraction(-Infinity as number)).toBeNaN();
  });

  it("returns zero fraction for 0", () => {
    expect(inchesToFraction(0)).toEqual({ whole: 0, numerator: 0, denominator: 1 });
  });

  it("throws for negative values", () => {
    expect(() => inchesToFraction(-1)).toThrow("Negative values are not allowed");
  });

  it("converts 5.5 to 5 1/2", () => {
    expect(inchesToFraction(5.5)).toEqual({ whole: 5, numerator: 1, denominator: 2 });
  });

  it("converts 6.125 to 6 1/8", () => {
    expect(inchesToFraction(6.125)).toEqual({ whole: 6, numerator: 1, denominator: 8 });
  });

  it("rolls over when rounding pushes to next whole", () => {
    expect(inchesToFraction(2.999)).toEqual({ whole: 3, numerator: 0, denominator: 1 });
  });
});
