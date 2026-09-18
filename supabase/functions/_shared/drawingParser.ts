/**
 * Drawing parser — derive a bar's cut (developed) length from its leg
 * dimensions when the manifest's "total length" column is missing or zero.
 *
 * Rebar schedules store bent bars as a set of leg dimensions (A, B, C … R).
 * The cut length (blank stock before bending) is the sum of those legs.
 * Straight bars follow the same convention: their length lives in the B
 * dimension (see straight-bar normalization), so summing the legs recovers
 * the length for both straight and bent shapes.
 *
 * This is the safety net that stops a row with a missing "length" value from
 * silently producing a zero-length cut item (a "dropped line").
 *
 * Unit note: values are summed in the source unit (mm / in / ft) and are NOT
 * converted — matching how `total_length_mm` and `cut_length_mm` are stored.
 */

/** Dimension columns in extraction order. Rebar standards skip "I". */
export const LEG_DIMENSION_FIELDS = [
  "dim_a", "dim_b", "dim_c", "dim_d", "dim_e", "dim_f",
  "dim_g", "dim_h", "dim_j", "dim_k", "dim_o", "dim_r",
] as const;

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Sum all positive leg dimensions. Returns null when no leg has a value. */
export function sumLegDimensions(row: Record<string, unknown> | null | undefined): number | null {
  if (!row) return null;
  let sum = 0;
  let found = false;
  for (const field of LEG_DIMENSION_FIELDS) {
    const n = toFiniteNumber(row[field]);
    if (n !== null && n > 0) {
      sum += n;
      found = true;
    }
  }
  if (!found) return null;
  // Round to 3 decimals to drop float noise (e.g. 10.1 + 10.2 → 20.3).
  return Math.round(sum * 1000) / 1000;
}

/**
 * Resolve a row's cut length. Prefers the manifest's total length; falls back
 * to the sum of leg dimensions so a missing length never drops a line.
 * Returns null only when there is neither a length nor any leg dimension.
 */
export function deriveCutLength(row: Record<string, unknown> | null | undefined): number | null {
  const total = toFiniteNumber(row?.["total_length_mm"]);
  if (total !== null && total > 0) return total;
  return sumLegDimensions(row);
}
