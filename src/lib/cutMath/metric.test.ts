// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  piecesPerBarMetric,
  computeRunPlanMetric,
  formatLengthMetric,
  REMNANT_THRESHOLD_MM,
} from "./metric";

describe("metric cut math", () => {
  it("12 m stock, 1524 mm cut → 7 pcs/bar", () => {
    expect(piecesPerBarMetric(12000, 1524)).toBe(7);
  });

  it("threshold is 300 mm", () => {
    expect(REMNANT_THRESHOLD_MM).toBe(300);
  });

  it("computeRunPlanMetric — full + partial bar", () => {
    const r = computeRunPlanMetric({ stockMm: 12000, cutMm: 1524, remainingPieces: 50, maxBars: 10 });
    expect(r.piecesPerBar).toBe(7);
    expect(r.totalBarsNeeded).toBe(8);
    expect(r.fullBars).toBe(7);
    expect(r.lastBarPieces).toBe(1);
  });

  it("formatLengthMetric appends mm", () => {
    expect(formatLengthMetric(1524)).toBe("1524 mm");
  });
});
