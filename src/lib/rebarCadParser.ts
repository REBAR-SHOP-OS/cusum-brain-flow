/**
 * Shared RebarCAD XLS parser for the frontend.
 * Single source of truth — used by Order Calculator and any future barlist upload.
 *
 * Mirrors the canonical logic from supabase/functions/_shared/rebarCADParser.ts
 * but is browser-safe (no Deno/Node deps).
 */

// ── Bar-size normalisation ──────────────────────────────────────────

const BAR_SIZE_MAP: Record<string, string> = {
  "10": "10M", "10M": "10M", "#3": "10M",
  "15": "15M", "15M": "15M", "#5": "15M",
  "20": "20M", "20M": "20M", "#6": "20M",
  "25": "25M", "25M": "25M", "#8": "25M",
  "30": "30M", "30M": "30M", "#9": "30M",
  "35": "35M", "35M": "35M", "#11": "35M",
};

const VALID_SIZES = new Set(Object.values(BAR_SIZE_MAP));

export function normalizeBarSize(raw: string): string {
  const cleaned = raw?.toString().trim().toUpperCase().replace(/\s/g, "");
  return BAR_SIZE_MAP[cleaned] ?? cleaned;
}

// ── Types ───────────────────────────────────────────────────────────

export interface ParsedItem {
  bar_size: string;
  quantity: number;
  cut_length_mm: number;
}

export interface ParseDiagnostics {
  items: ParsedItem[];
  sheetName: string | null;
  headerRow: number | null;
  skippedSheets: { name: string; reason: string }[];
}

// ── Header alias matching ───────────────────────────────────────────

const si = (c: string, t: string) => typeof c === "string" && c.includes(t);
const se = (c: string, ...ts: string[]) => typeof c === "string" && ts.includes(c);

function findColumnMap(cells: string[]): Record<string, number> | null {
  const pcsIdx = cells.findIndex(c =>
    si(c, "pcs") || si(c, "no.") || se(c, "qty", "quantity", "no. pcs", "no.pcs", "pieces")
  );
  const sizeIdx = cells.findIndex(c =>
    se(c, "size", "bar size", "bar_size", "barsize", "dia", "diameter")
  );
  const lengthIdx = cells.findIndex(c =>
    se(c, "length", "cut length", "total length", "cut_length", "bar length", "len")
  );
  const itemIdx = cells.findIndex(c =>
    se(c, "item", "item no", "item no.", "item_no", "itemno", "#", "no")
  );

  // Need at least a size column, or item+length to be meaningful
  if (sizeIdx < 0 && !(itemIdx >= 0 && lengthIdx >= 0)) return null;

  return {
    pcs: pcsIdx >= 0 ? pcsIdx : 1,
    size: sizeIdx >= 0 ? sizeIdx : 3,
    length: lengthIdx >= 0 ? lengthIdx : 4,
  };
}

// ── Core sheet parser ───────────────────────────────────────────────

const MAX_HEADER_SCAN_ROWS = 30;

function parseSheet(rows: any[][]): { items: ParsedItem[]; headerRow: number | null } {
  if (!rows || rows.length < 2) return { items: [], headerRow: null };

  let headerIdx = -1;
  let colMap: Record<string, number> | null = null;

  // Phase 1: Find header row by scanning up to MAX_HEADER_SCAN_ROWS
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, rows.length); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const cells = row.map((c: any) => {
      try { return String(c ?? "").trim().toLowerCase(); } catch { return ""; }
    });
    const map = findColumnMap(cells);
    if (map) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }

  // Phase 2: Fallback — use standard RebarCAD positional layout
  if (headerIdx < 0) {
    colMap = { pcs: 1, size: 3, length: 4 };
    // Try starting from several candidate rows
    const bestStart = findBestDataStart(rows, colMap);
    if (bestStart < 0) return { items: [], headerRow: null };
    headerIdx = bestStart - 1; // pretend previous row is header
  }

  if (!colMap) return { items: [], headerRow: null };

  const items: ParsedItem[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const rawSize = String(row[colMap.size] ?? "").trim();
    if (!rawSize || rawSize === "0") continue;

    const bar_size = normalizeBarSize(rawSize);
    // Skip if not a recognized rebar size
    if (!VALID_SIZES.has(bar_size)) continue;

    const quantity = parseInt(String(row[colMap.pcs] ?? "0")) || 0;
    if (quantity <= 0) continue;

    const rawLen = parseFloat(String(row[colMap.length] ?? "0")) || 0;
    if (rawLen <= 0) continue;

    items.push({ bar_size, quantity, cut_length_mm: rawLen });
  }

  return { items, headerRow: headerIdx };
}

/**
 * Scan rows with a positional colMap and find the first row that looks like
 * valid rebar data (has a recognized bar size, positive qty, positive length).
 */
function findBestDataStart(rows: any[][], colMap: Record<string, number>): number {
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS + 5, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const rawSize = String(row[colMap.size] ?? "").trim();
    const bar_size = normalizeBarSize(rawSize);
    if (!VALID_SIZES.has(bar_size)) continue;
    const qty = parseInt(String(row[colMap.pcs] ?? "0")) || 0;
    if (qty <= 0) continue;
    const len = parseFloat(String(row[colMap.length] ?? "0")) || 0;
    if (len <= 0) continue;
    return i; // first valid data row
  }
  return -1;
}

// ── Multi-sheet workbook parser ─────────────────────────────────────

import { utils } from "@e965/xlsx";
import type { WorkBook } from "@e965/xlsx";

export function parseWorkbook(wb: WorkBook): ParseDiagnostics {
  const skippedSheets: ParseDiagnostics["skippedSheets"] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      skippedSheets.push({ name: sheetName, reason: "Empty sheet" });
      continue;
    }

    const rows: any[][] = utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 2) {
      skippedSheets.push({ name: sheetName, reason: "Too few rows" });
      continue;
    }

    const { items, headerRow } = parseSheet(rows);

    if (items.length > 0) {
      return { items, sheetName, headerRow, skippedSheets };
    }

    skippedSheets.push({ name: sheetName, reason: "No valid rebar items found" });
  }

  return { items: [], sheetName: null, headerRow: null, skippedSheets };
}

/**
 * Build a user-friendly failure message from diagnostics.
 */
export function diagnosticMessage(d: ParseDiagnostics): string {
  if (d.skippedSheets.length === 0) return "The file appears to be empty.";
  const reasons = d.skippedSheets.map(s => `"${s.name}": ${s.reason}`).join("; ");
  return `No rebar items found. Sheets checked: ${reasons}`;
}
