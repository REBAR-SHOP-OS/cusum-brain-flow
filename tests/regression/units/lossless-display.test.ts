/**
 * REGRESSION: The lossless display contract says the rendered string must
 * be byte-identical to the source string when mode is "auto". Any future
 * auto-conversion that mutates `display` is forbidden.
 *
 * Related: mem://features/office/import-unit-detection
 */
import { describe, it, expect } from "vitest";
import { normalizeDimension, formatForDisplay } from "@/lib/units/normalizeMixedUnits";

const FIXTURES = [
  `6'6"`,
  `9'4"`,
  `24"`,
  `49"`,
  `1524`,
  `1524mm`,
  `12'`,
];

describe("units: lossless display contract", () => {
  for (const src of FIXTURES) {
    it(`preserves "${src}" verbatim in auto mode`, () => {
      const r = normalizeDimension(src);
      expect(formatForDisplay(r, "auto")).toBe(src);
      expect(r.display).toBe(src);
    });
  }
});
