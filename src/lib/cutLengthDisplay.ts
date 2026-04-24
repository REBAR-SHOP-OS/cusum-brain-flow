import { formatLength, type UnitSystem } from "./unitSystem";

/**
 * Single source of truth for displaying a cut-plan item's "cut each piece to" length.
 * Ensures the cutter station big number, the production card center, and the printed
 * rebar tag all show the exact same string for the same item.
 *
 * Rule: imperial items always render as canonical FT-IN via formatLength(mm, "imperial").
 * We never trust source_total_length_text alone — that's just the raw spelling from the
 * importer (e.g. `60"`, `5'`, `5'-0"`) and produces inconsistent units across surfaces.
 */
export interface CutLengthDisplay {
  value: string;          // e.g. "5'-0\""  or "1524"
  unitLabel: "FT-IN" | "FT" | "IN" | "MM";
}

interface ItemLike {
  cut_length_mm?: number | null;
  unit_system?: string | null;
  source_total_length_text?: string | null;
}

function isImperial(unitSystem?: string | null, sourceText?: string | null): boolean {
  const u = (unitSystem || "").toLowerCase();
  if (u === "in" || u === "ft" || u === "imperial") return true;
  if (u === "mm" || u === "metric") return false;
  // Fallback: infer from source text spelling
  const t = sourceText || "";
  return t.includes("'") || t.includes('"');
}

export function formatCutLength(item: ItemLike): CutLengthDisplay {
  const mm = item.cut_length_mm ?? 0;
  const imperial = isImperial(item.unit_system, item.source_total_length_text);

  if (imperial) {
    const value = formatLength(mm, "imperial"); // canonical e.g. 5'-0"
    const label: CutLengthDisplay["unitLabel"] =
      value.includes("'") && value.includes('"') ? "FT-IN"
      : value.includes("'") ? "FT"
      : "IN";
    return { value, unitLabel: label };
  }

  return { value: String(mm), unitLabel: "MM" };
}
