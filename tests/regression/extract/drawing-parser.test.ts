// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  deriveCutLength,
  sumLegDimensions,
  LEG_DIMENSION_FIELDS,
} from "../../../supabase/functions/_shared/drawingParser.ts";

describe("drawingParser", () => {
  it("prefers total_length_mm when present", () => {
    const row = { total_length_mm: 4500, dim_a: 1000, dim_b: 1500 };
    expect(deriveCutLength(row)).toBe(4500);
  });

  it("derives cut length from leg dimensions when length is missing", () => {
    // Bent bar: A + B + C
    const row = { total_length_mm: null, dim_a: 500, dim_b: 1200, dim_c: 500 };
    expect(deriveCutLength(row)).toBe(2200);
  });

  it("recovers straight-bar length from the B dimension", () => {
    // Straight bars carry length in B (A is blank after normalization).
    const row = { total_length_mm: null, dim_a: null, dim_b: 6000 };
    expect(deriveCutLength(row)).toBe(6000);
  });

  it("ignores zero and negative legs", () => {
    const row = { total_length_mm: 0, dim_a: 0, dim_b: -5, dim_c: 800 };
    expect(deriveCutLength(row)).toBe(800);
  });

  it("returns null when there is neither length nor legs", () => {
    expect(deriveCutLength({ total_length_mm: null, dim_a: null })).toBeNull();
    expect(deriveCutLength(null)).toBeNull();
  });

  it("rounds away float noise", () => {
    const row = { total_length_mm: null, dim_a: 10.1, dim_b: 10.2 };
    expect(sumLegDimensions(row)).toBe(20.3);
  });

  it("exposes the expected dimension fields", () => {
    expect(LEG_DIMENSION_FIELDS).toContain("dim_a");
    expect(LEG_DIMENSION_FIELDS).toContain("dim_r");
    // Rebar standard skips "I" — there must be no dim_i.
    expect(LEG_DIMENSION_FIELDS).not.toContain("dim_i");
  });
});
