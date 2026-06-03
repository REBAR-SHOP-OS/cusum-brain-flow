/**
 * Deterministic PDF table extractor for rebar schedules.
 *
 * Uses pdfjs-dist to read text items with X/Y coordinates,
 * groups them into rows, detects the schedule header row, then
 * maps every cell to its column by X-position (NOT by guessed order).
 *
 * This eliminates the column-shifting problem caused by sending
 * dense schedule PDFs straight to a vision model.
 */

// pdfjs-dist legacy build works in Deno (no DOM/worker required when disableWorker=true)
// We import dynamically inside the function to keep cold-start small for non-PDF flows.

export interface PdfRebarItem {
  dwg: string | null;
  item: string | null;
  grade: string | null;
  mark: string | null;
  quantity: number | null;
  size: string | null;
  type: string | null;
  total_length: string | null;
  A: string | null; B: string | null; C: string | null; D: string | null;
  E: string | null; F: string | null; G: string | null; H: string | null;
  I: null; // always null — rebar standard skips I
  J: string | null; K: string | null; O: string | null; R: string | null;
  weight: string | null;
}

export interface PdfTableResult {
  items: PdfRebarItem[];
  pages: number;
  headerFound: boolean;
  reason?: string;
}

interface TextItem { str: string; x: number; y: number; width: number; }

const DIM_LETTERS = ["A","B","C","D","E","F","G","H","J","K","O","R"] as const;

// Header label aliases — normalized lowercase no-symbol
const HEADER_ALIASES: Record<string, string> = {
  "dwg": "dwg", "dwg#": "dwg", "dwgno": "dwg", "drawing": "dwg", "drg": "dwg",
  "#": "item", "no": "item", "item": "item", "itemno": "item",
  "grade": "grade",
  "mark": "mark", "barmark": "mark",
  "qty": "qty", "quantity": "qty", "pcs": "qty", "nopcs": "qty",
  "size": "size", "barsize": "size",
  "type": "type", "shape": "type", "bendtype": "type",
  "length": "length", "cutlength": "length", "totallength": "length",
  "weight": "weight", "wgt": "weight", "kg": "weight",
};

function normHeader(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/\(.*\)/g, "").replace(/[^a-z0-9#]/g, "");
}

async function loadPdf(bytes: Uint8Array): Promise<any> {
  // Use the legacy ESM build — works in Deno without canvas/worker.
  // Pin to 3.11.174 because newer versions transitively pull `canvas.node`
  // through esm.sh, which fails to resolve in the edge runtime and blocks
  // every deploy of this function.
  const pdfjs: any = await import("https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs");
  // @ts-ignore — disable worker; Deno has no DOM Worker
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  return await loadingTask.promise;
}

async function readPageItems(page: any): Promise<TextItem[]> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const it of content.items as any[]) {
    const str = (it.str ?? "").trim();
    if (!str) continue;
    // transform = [a, b, c, d, e, f]; e=x, f=y in PDF user space (origin bottom-left)
    items.push({
      str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width ?? str.length * 4,
    });
  }
  return items;
}

/** Group items into rows by Y, then sort each row by X. */
function groupRows(items: TextItem[], yTolerance = 2.5): TextItem[][] {
  if (items.length === 0) return [];
  // Sort by Y descending (PDF Y grows upward; top of page = largest Y)
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: TextItem[][] = [];
  let current: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      current.push(sorted[i]);
    } else {
      rows.push(current.sort((a, b) => a.x - b.x));
      current = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  rows.push(current.sort((a, b) => a.x - b.x));
  return rows;
}

interface ColumnSpec { key: string; xCenter: number; }

/**
 * Find the header row and return ordered column specs (by X position).
 * A header row must contain at least 4 recognized labels including a dim letter or "length".
 */
function detectHeader(rows: TextItem[][]): { headerIdx: number; cols: ColumnSpec[] } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const matched: ColumnSpec[] = [];
    for (const it of row) {
      const n = normHeader(it.str);
      if (HEADER_ALIASES[n]) {
        matched.push({ key: HEADER_ALIASES[n], xCenter: it.x + it.width / 2 });
        continue;
      }
      // Single-letter dim column
      const up = it.str.trim().toUpperCase().replace(/[^A-Z]/g, "");
      if (up.length === 1 && (DIM_LETTERS as readonly string[]).includes(up)) {
        matched.push({ key: up, xCenter: it.x + it.width / 2 });
      }
    }
    // Require a meaningful header: at least 1 of {mark,size,length} AND >=2 dim letters
    const keys = new Set(matched.map((c) => c.key));
    const hasCore = keys.has("mark") || keys.has("size") || keys.has("length");
    const dimCount = matched.filter((c) => (DIM_LETTERS as readonly string[]).includes(c.key as any)).length;
    if (hasCore && dimCount >= 2 && matched.length >= 4) {
      // Sort by X
      matched.sort((a, b) => a.xCenter - b.xCenter);
      // Dedupe duplicate keys (keep first occurrence)
      const seen = new Set<string>();
      const cols = matched.filter((c) => {
        if (seen.has(c.key)) return false;
        seen.add(c.key);
        return true;
      });
      return { headerIdx: i, cols };
    }
  }
  return null;
}

/** Assign each row text item to its column by nearest xCenter. */
function rowToCells(row: TextItem[], cols: ColumnSpec[]): Record<string, string> {
  const cells: Record<string, string[]> = {};
  for (const c of cols) cells[c.key] = [];
  // Build mid-boundaries between adjacent columns
  const boundaries: number[] = [];
  for (let i = 0; i < cols.length - 1; i++) {
    boundaries.push((cols[i].xCenter + cols[i + 1].xCenter) / 2);
  }
  for (const it of row) {
    let colIdx = 0;
    for (; colIdx < boundaries.length; colIdx++) {
      if (it.x + it.width / 2 < boundaries[colIdx]) break;
    }
    cells[cols[colIdx].key].push(it.str);
  }
  const out: Record<string, string> = {};
  for (const k of Object.keys(cells)) out[k] = cells[k].join(" ").trim();
  return out;
}

function cellToItem(cells: Record<string, string>): PdfRebarItem {
  const get = (k: string) => (cells[k] && cells[k].length > 0 ? cells[k] : null);
  const qtyRaw = get("qty");
  const qty = qtyRaw ? parseInt(qtyRaw.replace(/[^\d]/g, ""), 10) : null;
  return {
    dwg: get("dwg"),
    item: get("item"),
    grade: get("grade"),
    mark: get("mark"),
    quantity: qty != null && !isNaN(qty) ? qty : null,
    size: get("size"),
    type: get("type"),
    total_length: get("length"),
    A: get("A"), B: get("B"), C: get("C"), D: get("D"),
    E: get("E"), F: get("F"), G: get("G"), H: get("H"),
    I: null,
    J: get("J"), K: get("K"), O: get("O"), R: get("R"),
    weight: get("weight"),
  };
}

/** Heuristic: skip rows that have no real data (e.g. footer totals, page numbers). */
function isDataRow(item: PdfRebarItem): boolean {
  // Must have at least a mark OR size OR length to count as a real bar row
  return !!(item.mark || item.size || item.total_length);
}

/**
 * Main entry: parse a PDF buffer and return structured rebar items by column.
 * Returns headerFound=false when the PDF is scanned / has no extractable text /
 * does not match a rebar schedule layout. Caller should then fall back to the AI path.
 */
export async function extractRebarTableFromPdf(bytes: Uint8Array): Promise<PdfTableResult> {
  let pdf: any;
  try {
    pdf = await loadPdf(bytes);
  } catch (e) {
    return { items: [], pages: 0, headerFound: false, reason: `pdf load failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const allItems: PdfRebarItem[] = [];
  let headerFoundAnywhere = false;
  let activeCols: ColumnSpec[] | null = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const text = await readPageItems(page);
    if (text.length === 0) continue;
    const rows = groupRows(text);

    // Try to detect header on this page; if none found, reuse columns from previous page
    const header = detectHeader(rows);
    let cols: ColumnSpec[] | null = activeCols;
    let dataStart = 0;
    if (header) {
      cols = header.cols;
      dataStart = header.headerIdx + 1;
      activeCols = cols;
      headerFoundAnywhere = true;
    }
    if (!cols) continue; // no header yet on this or prior page → skip

    for (let r = dataStart; r < rows.length; r++) {
      const cells = rowToCells(rows[r], cols);
      const item = cellToItem(cells);
      if (isDataRow(item)) allItems.push(item);
    }
  }

  if (!headerFoundAnywhere) {
    return { items: [], pages: pdf.numPages, headerFound: false, reason: "no schedule header detected" };
  }
  return { items: allItems, pages: pdf.numPages, headerFound: true };
}

// Exported for unit tests
export const __test__ = { groupRows, detectHeader, rowToCells, cellToItem, normHeader };
