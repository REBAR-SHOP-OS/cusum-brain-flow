import { formatLength } from "./unitSystem";
import { formatLength as formatLengthByUnit, isImperial } from "./cutMath";

/**
 * Single source of truth for displaying a cut-plan item's "cut each piece to" length.
 * Ensures the cutter station big number, the production card center, and the printed
 * rebar tag all show the exact same string for the same item.
 *
 * IMPORTANT: `cut_length_mm` is misnamed — for imperial rows it stores the raw numeric
 * value in the source unit (e.g. 8' is stored as 96, not 2438mm). So we cannot treat it
 * as millimeters. Instead we trust `source_total_length_text` (the canonical importer
 * spelling like `8'`, `5'-0"`, `60"`) and only fall back to numeric conversion when the
 * source text is missing.
 */
export interface CutLengthDisplay {
  value: string;          // e.g. "8'"  or "5'-0\""  or "1524"
  unitLabel: "FT-IN" | "FT" | "IN" | "MM";
}

interface ItemLike {
  cut_length_mm?: number | null;
  unit_system?: string | null;
  source_total_length_text?: string | null;
}

function labelFromText(text: string): CutLengthDisplay["unitLabel"] {
  const hasFt = text.includes("'");
  const hasIn = text.includes('"');
  if (hasFt && hasIn) return "FT-IN";
  if (hasFt) return "FT";
  if (hasIn) return "IN";
  return "MM";
}

export function formatCutLength(item: ItemLike): CutLengthDisplay {
  const src = (item.source_total_length_text || "").trim();
  if (src) {
    return { value: src, unitLabel: labelFromText(src) };
  }

  // Fallback: no source text — interpret raw numeric by declared unit_system.
  const raw = item.cut_length_mm ?? 0;
  const u = (item.unit_system || "").toLowerCase();

  // Imperial pipeline: raw is already in inches; format directly without conversion.
  if (isImperial(u)) {
    const value = formatLengthByUnit(raw, u);
    return { value, unitLabel: labelFromText(value) };
  }

  return { value: String(raw), unitLabel: "MM" };
}
