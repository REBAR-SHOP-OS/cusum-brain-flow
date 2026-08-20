// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  piecesPerBarImperial,
  computeRunPlanImperial,
  formatLengthImperial,
  REMNANT_THRESHOLD_IN,
} from "./imperial";

describe("imperial cut math", () => {
  it("regression: 40' stock, 8' cut → 5 pcs/bar (was 125)", () => {
    expect(piecesPerBarImperial(480, 96)).toBe(5);
  });

  it("returns 0 pcs/bar when cut > stock", () => {
    expect(piecesPerBarImperial(96, 480)).toBe(0);
  });

  it("computeRunPlanImperial — 49 pieces of 8' on 40' stock", () => {
    const r = computeRunPlanImperial({ stockIn: 480, cutIn: 96, remainingPieces: 49, maxBars: 10 });
    expect(r.piecesPerBar).toBe(5);
    expect(r.totalBarsNeeded).toBe(10);
    expect(r.fullBars).toBe(9);
    expect(r.lastBarPieces).toBe(4);
    expect(r.lastBarRemnant).toBe(480 - 4 * 96); // 96"
    expect(r.lastBarRemnant >= REMNANT_THRESHOLD_IN).toBe(true);
  });

  it("formatLengthImperial covers ft, ft-in, fractions", () => {
    expect(formatLengthImperial(96)).toBe("8'");
    expect(formatLengthImperial(66)).toBe(`5'-6"`);
    expect(formatLengthImperial(6.5)).toBe(`6½"`);
    expect(formatLengthImperial(0)).toBe(`0"`);
  });

  it("threshold is 12 inches", () => {
    expect(REMNANT_THRESHOLD_IN).toBe(12);
  });
});
