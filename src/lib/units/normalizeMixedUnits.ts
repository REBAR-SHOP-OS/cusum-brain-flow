/**
 * Mixed-unit normalization for imported rebar / dimension rows.
 *
 * Canadian shops routinely receive a single spreadsheet containing ft-in,
 * inches, and millimetres in different rows. The lossless-display contract
 * (see `mem://features/office/import-unit-detection`) forbids rewriting the
 * source string — but downstream math (cut-length, weight) still needs a
 * canonical numeric value.
 *
 * This helper returns BOTH:
 *   - `display`  : the original source string, unchanged
 *   - `unit`     : detected unit tag ("ft-in" | "in" | "mm" | "unknown")
 *   - `mm`       : canonical millimetre value for math, or null if undetectable
 *
 * It NEVER mutates the source string. A later UI toggle (Auto / Force ft-in /
 * Force inches / Force mm) can re-format `display` per-view without changing
 * stored data.
 */

export type DetectedUnit = "ft-in" | "in" | "mm" | "unknown";

export interface NormalizedDimension {
  display: string;
  unit: DetectedUnit;
  mm: number | null;
}

const FT_IN_RE = /^\s*(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?\s*$/;
const IN_RE = /^\s*(\d+(?:\.\d+)?)\s*"\s*$/;
const MM_RE = /^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*$/i;

const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;

export function normalizeDimension(source: string | number | null | undefined): NormalizedDimension {
  if (source === null || source === undefined) {
    return { display: "", unit: "unknown", mm: null };
  }

  const raw = String(source).trim();
  if (!raw) return { display: "", unit: "unknown", mm: null };

  // ft-in: 6'6"  or  6'  or  6'6
  const ftIn = raw.match(FT_IN_RE);
  if (ftIn) {
    const feet = parseFloat(ftIn[1]);
    const inches = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    if (isFinite(feet) && isFinite(inches)) {
      return {
        display: raw,
        unit: "ft-in",
        mm: feet * MM_PER_FOOT + inches * MM_PER_INCH,
      };
    }
  }

  // inches: 49"
  const inOnly = raw.match(IN_RE);
  if (inOnly) {
    const inches = parseFloat(inOnly[1]);
    return {
      display: raw,
      unit: "in",
      mm: isFinite(inches) ? inches * MM_PER_INCH : null,
    };
  }

  // millimetres: 1524  or  1524mm
  const mm = raw.match(MM_RE);
  if (mm) {
    const v = parseFloat(mm[1]);
    return {
      display: raw,
      unit: "mm",
      mm: isFinite(v) ? v : null,
    };
  }

  return { display: raw, unit: "unknown", mm: null };
}

/**
 * Normalize a row of mixed-unit cells in one pass. Order preserved.
 */
export function normalizeRow(cells: Array<string | number | null | undefined>): NormalizedDimension[] {
  return cells.map(normalizeDimension);
}

/**
 * View-time re-format. Does NOT change stored data — only the rendered string.
 * Use behind a UI toggle (Auto / ft-in / in / mm). "auto" returns the original
 * lossless display.
 */
export type DisplayMode = "auto" | "ft-in" | "in" | "mm";

export function formatForDisplay(d: NormalizedDimension, mode: DisplayMode = "auto"): string {
  if (mode === "auto" || d.mm === null) return d.display;

  if (mode === "mm") {
    return `${Math.round(d.mm)}mm`;
  }
  if (mode === "in") {
    const inches = d.mm / MM_PER_INCH;
    return `${Number.isInteger(inches) ? inches : inches.toFixed(2)}"`;
  }
  // ft-in
  const totalIn = d.mm / MM_PER_INCH;
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn - ft * 12;
  if (inches === 0) return `${ft}'`;
  const inStr = Number.isInteger(inches) ? String(inches) : inches.toFixed(2);
  return `${ft}'${inStr}"`;
}
