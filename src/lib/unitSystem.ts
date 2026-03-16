/**
 * Unit System utilities — metric (mm) vs imperial (ft-in).
 * Internal storage is always mm. Convert at display/input boundaries only.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────
export type UnitSystem = "metric" | "imperial";

// ─── Bar Size Mapping (Canadian RSIC ↔ US ASTM) ────────────
export const BAR_SIZE_MAP: Record<string, string> = {
  // metric → imperial
  "10M": "#3",
  "15M": "#5",
  "20M": "#6",
  "25M": "#8",
  "30M": "#9",
  "35M": "#11",
  "45M": "#14",
  "55M": "#18",
};

const IMPERIAL_TO_METRIC: Record<string, string> = Object.fromEntries(
  Object.entries(BAR_SIZE_MAP).map(([m, i]) => [i, m])
);

/** Convert a metric bar code to the display label for the active unit system */
export function barSizeLabel(metricCode: string, system: UnitSystem): string {
  if (system === "imperial") return BAR_SIZE_MAP[metricCode] || metricCode;
  return metricCode;
}

/** Convert an imperial bar code (e.g. "#6") back to metric ("20M") */
export function imperialToMetric(imperialCode: string): string | null {
  return IMPERIAL_TO_METRIC[imperialCode] || null;
}

/** Get all valid bar sizes for a unit system */
export function validBarSizes(system: UnitSystem): string[] {
  if (system === "imperial") return Object.values(BAR_SIZE_MAP);
  return Object.keys(BAR_SIZE_MAP);
}

// ─── Length Formatting ──────────────────────────────────────
const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;

/** Format a length (stored in mm) for display */
export function formatLength(mm: number, system: UnitSystem): string {
  if (system === "metric") return `${mm} mm`;

  const totalInches = mm / MM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  // Round to nearest 1/8
  const eighths = Math.round(inches * 8);
  const wholeInches = Math.floor(eighths / 8);
  const remainderEighths = eighths % 8;

  const fractionMap: Record<number, string> = {
    0: "",
    1: "⅛",
    2: "¼",
    3: "⅜",
    4: "½",
    5: "⅝",
    6: "¾",
    7: "⅞",
  };

  const frac = fractionMap[remainderEighths] || "";

  if (feet === 0) {
    return `${wholeInches}${frac}"`;
  }
  if (wholeInches === 0 && !frac) {
    return `${feet}'-0"`;
  }
  return `${feet}'-${wholeInches}${frac}"`;
}

/** Format length as a short numeric (no unit suffix) for tight UI spaces */
export function formatLengthShort(mm: number, system: UnitSystem): string {
  if (system === "metric") return `${mm}`;
  const totalInches = mm / MM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'-${inches}"`;
}

/** Parse a user-entered length string back to mm */
export function parseLength(input: string, system: UnitSystem): number | null {
  if (system === "metric") {
    const n = parseFloat(input.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  }

  // Imperial: try "X'-Y"" or "X' Y"" or just inches
  const ftIn = input.match(/(\d+)\s*['']\s*-?\s*(\d+(?:\.\d+)?)\s*[""]/);
  if (ftIn) {
    return Math.round(parseFloat(ftIn[1]) * MM_PER_FOOT + parseFloat(ftIn[2]) * MM_PER_INCH);
  }

  // Just feet: "6'"
  const ftOnly = input.match(/^(\d+(?:\.\d+)?)\s*['']\s*$/);
  if (ftOnly) {
    return Math.round(parseFloat(ftOnly[1]) * MM_PER_FOOT);
  }

  // Just inches: '72"'
  const inOnly = input.match(/^(\d+(?:\.\d+)?)\s*[""]\s*$/);
  if (inOnly) {
    return Math.round(parseFloat(inOnly[1]) * MM_PER_INCH);
  }

  // Plain number → treat as inches in imperial
  const plain = parseFloat(input);
  if (!isNaN(plain)) return Math.round(plain * MM_PER_INCH);

  return null;
}

/** Get the length unit label */
export function lengthUnit(system: UnitSystem): string {
  return system === "metric" ? "mm" : "in";
}

// ─── Hook: read company's unit_system ───────────────────────
export function useUnitSystem(): UnitSystem {
  const { user } = useAuth();
  const [system, setSystem] = useState<UnitSystem>("metric");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data: profile }) => {
        if (!profile?.company_id) return;
        supabase
          .from("companies")
          .select("unit_system")
          .eq("id", profile.company_id)
          .single()
          .then(({ data: company }) => {
            if (company?.unit_system === "imperial") {
              setSystem("imperial");
            }
          });
      });
  }, [user]);

  return system;
}
