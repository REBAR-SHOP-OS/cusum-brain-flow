/**
 * Shared RebarCAD XLS/PDF parsing logic.
 * Parses the standard RebarCAD export format used across 762+ historical bar lists.
 *
 * RebarCAD XLS columns (typical):
 *   Item | No. Pcs | Dwg.No | Size | Length | Mark | Type | A | B | C | D | E | F | G | H | I | J | K | R
 */

export interface ParsedBarlistItem {
  item_number: number;
  quantity: number;
  drawing_ref: string;
  bar_size: string;      // e.g. "10M", "15M", "20M"
  cut_length_mm: number;
  mark: string;
  bend_type: string;     // e.g. "00" (straight), "11", "51", etc.
  shape_code: string;    // derived: "straight", "L-shape", "U-bar", "stirrup", etc.
  dimensions: Record<string, number>; // A through R
  weight_kg: number;
  grade: string;
}

export interface ParsedBarlist {
  name: string;
  lead_id?: string;
  items: ParsedBarlistItem[];
  total_weight_kg: number;
  total_items: number;
  source_file_url: string;
}

// RebarCAD bar size mapping (Canadian metric)
const BAR_SIZE_MAP: Record<string, string> = {
  "10": "10M", "10M": "10M", "#3": "10M",
  "15": "15M", "15M": "15M", "#5": "15M",
  "20": "20M", "20M": "20M", "#6": "20M",
  "25": "25M", "25M": "25M", "#8": "25M",
  "30": "30M", "30M": "30M", "#9": "30M",
  "35": "35M", "35M": "35M", "#11": "35M",
};

// Weight per meter (kg/m) for Canadian metric sizes
const WEIGHT_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355,
  "25M": 3.925, "30M": 5.495, "35M": 7.850,
};

// Bend type to shape code mapping
const BEND_TYPE_MAP: Record<string, string> = {
  "00": "straight", "0": "straight",
  "11": "L-shape", "2": "L-shape",
  "12": "U-bar", "17": "U-bar",
  "51": "stirrup", "52": "stirrup",
  "31": "cranked", "3": "cranked",
  "T1": "trapezoidal",
};

/**
 * Normalize a bar size string to canonical form (e.g., "15M").
 */
export function normalizeBarSize(raw: string): string {
  const cleaned = raw?.toString().trim().toUpperCase().replace(/\s/g, "");
  return BAR_SIZE_MAP[cleaned] ?? cleaned;
}

/**
 * Derive shape code from bend type number.
 */
export function deriveShapeCode(bendType: string): string {
  return BEND_TYPE_MAP[bendType?.toString().trim()] ?? "other";
}

/**
 * Parse a 2D array of rows (from XLS) into structured bar list items.
 * Handles the standard RebarCAD export column layout.
 */
export function parseRebarCADRows(rows: any[][]): ParsedBarlistItem[] {
  if (!rows || rows.length < 2) return [];

  // Find header row — look for "Item" or "No." or "Pcs" in first few rows
  let headerIdx = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c: any) => String(c ?? "").trim().toLowerCase());

    // Look for key columns
    const itemIdx = cells.findIndex((c: string) => c === "item" || c === "item no" || c === "item no.");
    const pcsIdx = cells.findIndex((c: string) => c.includes("pcs") || c.includes("no.") || c === "qty" || c === "quantity");
    const sizeIdx = cells.findIndex((c: string) => c === "size" || c === "bar size");
    const lengthIdx = cells.findIndex((c: string) => c === "length" || c === "cut length" || c === "total length");
    const markIdx = cells.findIndex((c: string) => c === "mark" || c === "bar mark");
    const typeIdx = cells.findIndex((c: string) => c === "type" || c === "bend type" || c === "shape");
    const dwgIdx = cells.findIndex((c: string) => c.includes("dwg") || c.includes("drawing") || c.includes("drg"));

    if (sizeIdx >= 0 || (itemIdx >= 0 && lengthIdx >= 0)) {
      headerIdx = i;
      colMap = {
        item: itemIdx >= 0 ? itemIdx : 0,
        pcs: pcsIdx >= 0 ? pcsIdx : 1,
        dwg: dwgIdx >= 0 ? dwgIdx : 2,
        size: sizeIdx >= 0 ? sizeIdx : 3,
        length: lengthIdx >= 0 ? lengthIdx : 4,
        mark: markIdx >= 0 ? markIdx : 5,
        type: typeIdx >= 0 ? typeIdx : 6,
      };

      // Find dimension columns (A through R)
      const dimStart = Math.max(...Object.values(colMap)) + 1;
      "ABCDEFGHIJKR".split("").forEach((dim, idx) => {
        const ci = cells.findIndex((c: string) => c === dim.toLowerCase());
        colMap[dim] = ci >= 0 ? ci : dimStart + idx;
      });

      break;
    }
  }

  if (headerIdx < 0) {
    // Fallback: assume standard layout
    headerIdx = 0;
    colMap = { item: 0, pcs: 1, dwg: 2, size: 3, length: 4, mark: 5, type: 6 };
    "ABCDEFGHIJKR".split("").forEach((dim, idx) => {
      colMap[dim] = 7 + idx;
    });
  }

  const items: ParsedBarlistItem[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const rawSize = String(row[colMap.size] ?? "").trim();
    if (!rawSize || rawSize === "0") continue;

    const barSize = normalizeBarSize(rawSize);
    const quantity = parseInt(String(row[colMap.pcs] ?? "0")) || 0;
    if (quantity <= 0) continue;

    const cutLengthRaw = parseFloat(String(row[colMap.length] ?? "0")) || 0;
    // RebarCAD usually exports length in mm
    const cutLengthMm = cutLengthRaw > 100 ? cutLengthRaw : cutLengthRaw * 1000;

    const bendType = String(row[colMap.type] ?? "00").trim();
    const shapeCode = deriveShapeCode(bendType);

    // Parse dimensions
    const dimensions: Record<string, number> = {};
    for (const dim of "ABCDEFGHIJKR".split("")) {
      const val = parseFloat(String(row[colMap[dim]] ?? "0")) || 0;
      if (val > 0) dimensions[dim] = val;
    }

    // Calculate weight
    const wpm = WEIGHT_PER_M[barSize] ?? 0;
    const weightKg = Math.round(quantity * (cutLengthMm / 1000) * wpm * 100) / 100;

    items.push({
      item_number: parseInt(String(row[colMap.item] ?? i)) || i,
      quantity,
      drawing_ref: String(row[colMap.dwg] ?? "").trim(),
      bar_size: barSize,
      cut_length_mm: cutLengthMm,
      mark: String(row[colMap.mark] ?? "").trim(),
      bend_type: bendType,
      shape_code: shapeCode,
      dimensions,
      weight_kg: weightKg,
      grade: "400W",
    });
  }

  return items;
}

/**
 * Compute summary stats from parsed items.
 */
export function summarizeBarlist(items: ParsedBarlistItem[]): { total_weight_kg: number; total_items: number; by_size: Record<string, number> } {
  const bySize: Record<string, number> = {};
  let totalWeight = 0;

  for (const item of items) {
    totalWeight += item.weight_kg;
    bySize[item.bar_size] = (bySize[item.bar_size] ?? 0) + item.weight_kg;
  }

  return {
    total_weight_kg: Math.round(totalWeight * 100) / 100,
    total_items: items.length,
    by_size: bySize,
  };
}

/**
 * Compare AI-estimated items against ground truth bar list items.
 * Returns matched, missing, and extra items with weight deltas.
 */
export interface ComparisonResult {
  matched: Array<{
    mark: string;
    bar_size: string;
    estimated_qty: number;
    actual_qty: number;
    estimated_weight: number;
    actual_weight: number;
    weight_delta_pct: number;
  }>;
  missing: ParsedBarlistItem[];  // In ground truth but not in estimation
  extra: Array<{ mark: string; bar_size: string; quantity: number; weight_kg: number }>; // In estimation but not in ground truth
  total_estimated_weight: number;
  total_actual_weight: number;
  accuracy_pct: number;
}

export function compareEstimationToActual(
  estimatedItems: Array<{ mark?: string; bar_size: string; quantity: number; weight_kg: number }>,
  actualItems: ParsedBarlistItem[]
): ComparisonResult {
  const actualByMark = new Map<string, ParsedBarlistItem>();
  for (const item of actualItems) {
    const key = `${item.mark}|${item.bar_size}`;
    actualByMark.set(key, item);
  }

  const matched: ComparisonResult["matched"] = [];
  const extra: ComparisonResult["extra"] = [];
  const matchedKeys = new Set<string>();

  for (const est of estimatedItems) {
    const key = `${est.mark ?? ""}|${est.bar_size}`;
    const actual = actualByMark.get(key);

    if (actual) {
      matchedKeys.add(key);
      const delta = actual.weight_kg > 0
        ? Math.round(((est.weight_kg - actual.weight_kg) / actual.weight_kg) * 10000) / 100
        : 0;
      matched.push({
        mark: est.mark ?? "",
        bar_size: est.bar_size,
        estimated_qty: est.quantity,
        actual_qty: actual.quantity,
        estimated_weight: est.weight_kg,
        actual_weight: actual.weight_kg,
        weight_delta_pct: delta,
      });
    } else {
      extra.push({ mark: est.mark ?? "", bar_size: est.bar_size, quantity: est.quantity, weight_kg: est.weight_kg });
    }
  }

  const missing = actualItems.filter((a) => !matchedKeys.has(`${a.mark}|${a.bar_size}`));

  const totalEstimated = estimatedItems.reduce((s, i) => s + i.weight_kg, 0);
  const totalActual = actualItems.reduce((s, i) => s + i.weight_kg, 0);
  const accuracy = totalActual > 0
    ? Math.round((1 - Math.abs(totalEstimated - totalActual) / totalActual) * 10000) / 100
    : 0;

  return { matched, missing, extra, total_estimated_weight: totalEstimated, total_actual_weight: totalActual, accuracy_pct: accuracy };
}
