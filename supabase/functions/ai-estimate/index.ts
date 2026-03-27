import { handleRequest } from "../_shared/requestHandler.ts";
import {
  calculateItem,
  applyWasteFactor,
  computeProjectSummary,
  validateItem,
  type RebarStandard,
  type EstimationPricing,
  type EstimationItemInput,
  type EstimationItemResult,
  type ValidationRule,
} from "../_shared/rebarCalcEngine.ts";
import * as XLSX from "npm:xlsx@0.18.5";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Mass per meter lookup for deterministic fallback (kg/m)
const MASS_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925, "30M": 5.495, "35M": 7.850,
};

/**
 * Deterministic fallback parser for weight summary PDFs.
 * Scans AI response text (or raw content) for bar-size weight totals
 * and creates synthetic SUM- items with preserved weights.
 */
function parseWeightSummaryFallback(text: string): EstimationItemInput[] {
  const items: EstimationItemInput[] = [];

  // Pattern 1: Look for bar size totals like "10M" followed by a weight number
  // Matches patterns like: "10M = 261.74 kg", "15M: 18,657.43", "20M 25858.14 kg"
  const barSizePattern = /\b(10|15|20|25|30|35)\s*M\b[^0-9]*?([\d,]+\.?\d*)\s*(?:kg|Kg|KG)?/gi;
  let match;
  const barTotals = new Map<string, number>();

  while ((match = barSizePattern.exec(text)) !== null) {
    const barSize = `${match[1]}M`;
    const weight = parseFloat(match[2].replace(/,/g, ""));
    if (weight > 0 && weight < 10_000_000) {
      // Keep the largest weight found for each bar size (likely the total)
      const existing = barTotals.get(barSize) || 0;
      if (weight > existing) barTotals.set(barSize, weight);
    }
  }

  // Pattern 2: Look for grand total
  const grandTotalMatch = text.match(/grand\s*total[^0-9]*([\d,]+\.?\d*)\s*(?:kg|Kg|KG|kgs|Kgs)/i);
  const grandTotalKg = grandTotalMatch ? parseFloat(grandTotalMatch[1].replace(/,/g, "")) : 0;

  // Pattern 3: Look for element-level weights
  const elementPatterns = [
    { regex: /raft\s*slab[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "slab", ref: "RAFT SLAB", abbr: "RS" },
    { regex: /\bwall\b[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "wall", ref: "WALL", abbr: "WALL" },
    { regex: /grade\s*beam[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "grade_beam", ref: "GRADE BEAMS", abbr: "GB" },
    { regex: /\bpier[s]?\b[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "pier", ref: "PIERS", abbr: "PIER" },
    { regex: /\bcolumn[s]?\b[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "column", ref: "COLUMN", abbr: "COL" },
    { regex: /\bfooting[s]?\b[^0-9]*([\d,]+\.?\d*)\s*(?:kg)?/gi, type: "footing", ref: "FOOTING", abbr: "FT" },
  ];

  // If we have bar-size totals, create one item per bar size
  if (barTotals.size > 0) {
    console.log("Fallback found bar-size totals:", Object.fromEntries(barTotals));
    for (const [barSize, weightKg] of barTotals) {
      const massPerM = MASS_PER_M[barSize] || 1.570;
      const cutLengthMm = (weightKg / massPerM) * 1000;
      items.push({
        element_type: "mixed",
        element_ref: "Weight Summary",
        mark: `SUM-TOT-${barSize}`,
        bar_size: barSize,
        quantity: 1,
        cut_length_mm: Math.round(cutLengthMm),
        hook_type_near: "none",
        hook_type_far: "none",
        lap_type: "none",
        num_laps: 0,
        shape_code: "straight",
        weight_kg: weightKg,
      } as any);
    }
  }
  // If no bar-size totals but have grand total, create a single item
  else if (grandTotalKg > 0) {
    console.log("Fallback found grand total:", grandTotalKg, "kg");
    const defaultBarSize = "20M";
    const massPerM = MASS_PER_M[defaultBarSize]!;
    items.push({
      element_type: "mixed",
      element_ref: "Grand Total",
      mark: `SUM-TOT-${defaultBarSize}`,
      bar_size: defaultBarSize,
      quantity: 1,
      cut_length_mm: Math.round((grandTotalKg / massPerM) * 1000),
      hook_type_near: "none",
      hook_type_far: "none",
      lap_type: "none",
      num_laps: 0,
      shape_code: "straight",
      weight_kg: grandTotalKg,
    } as any);
  }

  return items;
}

/**
 * Rescue fallback: extract weight data directly from AI's JSON items.
 * Groups by bar_size, sums any weight_kg hints, creates SUM- items.
 */
function rescueAIItems(items: any[]): EstimationItemInput[] {
  const bySize = new Map<string, number>();
  for (const item of items) {
    const size = item.bar_size;
    if (!size || !MASS_PER_M[size]) continue;
    const w = parseFloat(item.weight_kg) || 0;
    bySize.set(size, (bySize.get(size) || 0) + w);
  }
  const rescued: EstimationItemInput[] = [];
  for (const [barSize, weightKg] of bySize) {
    if (weightKg <= 0) continue;
    const massPerM = MASS_PER_M[barSize] || 1.570;
    rescued.push({
      element_type: "mixed",
      element_ref: "Weight Summary",
      mark: `SUM-TOT-${barSize}`,
      bar_size: barSize,
      quantity: 1,
      cut_length_mm: Math.round((weightKg / massPerM) * 1000),
      hook_type_near: "none",
      hook_type_far: "none",
      lap_type: "none",
      num_laps: 0,
      shape_code: "straight",
      weight_kg: weightKg,
    } as any);
  }
  return rescued;
}

// ─── BAR SIZE NORMALIZATION for XLSX parsing ───
const BAR_SIZE_NORMALIZE: Record<string, string> = {
  "10": "10M", "10M": "10M", "#3": "10M",
  "15": "15M", "15M": "15M", "#4": "15M", "#5": "15M",
  "20": "20M", "20M": "20M", "#6": "20M",
  "25": "25M", "25M": "25M", "#7": "25M", "#8": "25M",
  "30": "30M", "30M": "30M", "#9": "30M", "#10": "30M",
  "35": "35M", "35M": "35M", "#11": "35M",
};

function normalizeBarSize(raw: string): string | null {
  const cleaned = raw?.toString().trim().toUpperCase().replace(/\s/g, "");
  return BAR_SIZE_NORMALIZE[cleaned] ?? null;
}

/**
 * Deterministic XLSX/XLS/CSV parser.
 * Reads rows from a spreadsheet and extracts bar items by detecting
 * columns with bar sizes, quantities, lengths, and weights.
 */
function parseSpreadsheetToItems(workbook: XLSX.WorkBook): EstimationItemInput[] {
  const items: EstimationItemInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length < 2) continue;

    // Find header row by looking for key terms
    let headerIdx = -1;
    let colMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row)) continue;
      const cells = row.map((c: any) => String(c ?? "").trim().toLowerCase());

      const sizeIdx = cells.findIndex((c) => ["size", "bar size", "bar_size", "rebar size"].includes(c));
      const qtyIdx = cells.findIndex((c) => ["qty", "quantity", "no. pcs", "pcs", "no."].includes(c) || c.includes("pcs"));
      const lengthIdx = cells.findIndex((c) => ["length", "cut length", "total length", "cut_length"].includes(c));
      const markIdx = cells.findIndex((c) => ["mark", "bar mark", "item"].includes(c));
      const weightIdx = cells.findIndex((c) => c.includes("weight") || c.includes("mass") || c === "kg");
      const typeIdx = cells.findIndex((c) => ["type", "bend type", "shape", "shape_code"].includes(c));
      const dwgIdx = cells.findIndex((c) => c.includes("dwg") || c.includes("drawing") || c.includes("drg") || c.includes("element"));

      if (sizeIdx >= 0 || (qtyIdx >= 0 && lengthIdx >= 0)) {
        headerIdx = i;
        colMap = { size: sizeIdx, qty: qtyIdx, length: lengthIdx, mark: markIdx, weight: weightIdx, type: typeIdx, dwg: dwgIdx };
        break;
      }
    }

    if (headerIdx < 0) continue;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      // Try to find bar size
      const rawSize = colMap.size >= 0 ? String(row[colMap.size] ?? "").trim() : "";
      const barSize = normalizeBarSize(rawSize);
      if (!barSize) continue;

      const quantity = colMap.qty >= 0 ? (parseInt(String(row[colMap.qty] ?? "0")) || 0) : 1;
      if (quantity <= 0) continue;

      const cutLengthRaw = colMap.length >= 0 ? (parseFloat(String(row[colMap.length] ?? "0")) || 0) : 0;
      const cutLengthMm = cutLengthRaw > 100 ? cutLengthRaw : cutLengthRaw * 1000;

      const weightRaw = colMap.weight >= 0 ? (parseFloat(String(row[colMap.weight] ?? "0")) || 0) : 0;
      const massPerM = MASS_PER_M[barSize] || 1.570;
      const weightKg = weightRaw > 0 ? weightRaw : Math.round(quantity * (cutLengthMm / 1000) * massPerM * 100) / 100;

      const mark = colMap.mark >= 0 ? String(row[colMap.mark] ?? "").trim() : `R${items.length + 1}`;
      const bendType = colMap.type >= 0 ? String(row[colMap.type] ?? "").trim() : "";
      const dwgRef = colMap.dwg >= 0 ? String(row[colMap.dwg] ?? "").trim() : "";

      items.push({
        element_type: "mixed",
        element_ref: dwgRef || sheetName,
        mark: mark || `R${items.length + 1}`,
        bar_size: barSize,
        quantity,
        cut_length_mm: Math.round(cutLengthMm),
        hook_type_near: "none",
        hook_type_far: "none",
        lap_type: "none",
        num_laps: 0,
        shape_code: bendType === "00" || !bendType ? "straight" : "other",
        weight_kg: weightKg,
      } as any);
    }
  }

  return items;
}


Deno.serve((req) =>
  handleRequest(req, async ({ userId, companyId, serviceClient: supabaseAdmin, body }) => {
    const {
      name,
      customer_id,
      lead_id,
      file_urls = [],
      waste_factor_pct = 5,
      scope_context,
    } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Project name is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // ─── 1. Load standards, pricing, validation rules, AND historical learnings ───
    const [standardsRes, pricingRes, rulesRes, learningsRes, benchmarksRes] = await Promise.all([
      supabaseAdmin.from("rebar_standards").select("*"),
      supabaseAdmin
        .from("estimation_pricing")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
      supabaseAdmin
        .from("estimation_validation_rules")
        .select("*")
        .eq("is_active", true),
      supabaseAdmin
        .from("estimation_learnings")
        .select("element_type, bar_size, mark, field_name, original_value, corrected_value, weight_delta_pct, context, confidence_score")
        .eq("company_id", companyId)
        .gte("confidence_score", 70)
        .order("confidence_score", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("project_coordination_log")
        .select("project_name, estimation_weight_kg, detailing_weight_kg, weight_difference_kg, elements")
        .eq("company_id", companyId)
        .gt("detailing_weight_kg", 0)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const standards: RebarStandard[] = standardsRes.data ?? [];
    const pricing: EstimationPricing[] = pricingRes.data ?? [];
    const rules: ValidationRule[] = rulesRes.data ?? [];
    const learnings = learningsRes.data ?? [];
    const benchmarks = benchmarksRes.data ?? [];

    const standardsMap = new Map(standards.map((s) => [s.bar_size, s]));
    const pricingMap = new Map(pricing.map((p) => [p.bar_size, p]));

    // Build historical context string for Gemini
    let historicalContext = "";
    if (learnings.length > 0) {
      const avgDelta = learnings.reduce((s, l) => s + (l.weight_delta_pct ?? 0), 0) / learnings.length;
      historicalContext += `\n## HISTORICAL ACCURACY DATA (from ${learnings.length} past corrections)\n`;
      historicalContext += `Average estimation overestimate: ${avgDelta.toFixed(1)}%\n`;

      const byElement = new Map<string, { count: number; avgDelta: number }>();
      for (const l of learnings) {
        const et = l.element_type ?? "unknown";
        const entry = byElement.get(et) ?? { count: 0, avgDelta: 0 };
        entry.count++;
        entry.avgDelta += l.weight_delta_pct ?? 0;
        byElement.set(et, entry);
      }
      for (const [et, stats] of byElement) {
        historicalContext += `- ${et}: avg ${(stats.avgDelta / stats.count).toFixed(1)}% overestimate (${stats.count} samples)\n`;
      }
    }
    if (benchmarks.length > 0) {
      historicalContext += `\n## WEIGHT BENCHMARKS FROM COMPLETED PROJECTS\n`;
      for (const b of benchmarks.slice(0, 5)) {
        historicalContext += `- "${b.project_name}": est=${b.estimation_weight_kg}kg, actual=${b.detailing_weight_kg}kg (${((b.weight_difference_kg / b.estimation_weight_kg) * 100).toFixed(1)}% delta)\n`;
      }
    }

    // ─── 2. Separate files by type: spreadsheets (deterministic) vs PDF/images (AI) ───
    let extractedItems: EstimationItemInput[] = [];
    let spreadsheetItems: EstimationItemInput[] = [];
    let hadSpreadsheetFiles = false;
    let hadAIFiles = false;

    if (file_urls.length > 0) {
      const contentParts: any[] = [];

      function arrayBufferToBase64(buffer: Uint8Array): string {
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
          for (let j = 0; j < chunk.length; j++) {
            binary += String.fromCharCode(chunk[j]);
          }
        }
        return btoa(binary);
      }

      for (const url of file_urls.slice(0, 4)) {
        const lower = url.toLowerCase();
        const isPdf = /\.pdf(\?|$)/.test(lower);
        const isImage = /\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower);
        const isCsv = /\.csv(\?|$)/.test(lower);
        const isSpreadsheet = /\.(xlsx|xls)(\?|$)/.test(lower);

        if (isSpreadsheet) {
          // ─── DETERMINISTIC XLSX PARSING ───
          hadSpreadsheetFiles = true;
          try {
            const res = await fetch(url);
            if (!res.ok) { console.error(`Failed to fetch spreadsheet: ${url} (${res.status})`); continue; }
            const bytes = new Uint8Array(await res.arrayBuffer());
            console.log(`Parsing spreadsheet: ${(bytes.length / 1024).toFixed(0)}KB`);
            const workbook = XLSX.read(bytes, { type: "array" });
            const parsed = parseSpreadsheetToItems(workbook);
            console.log(`Spreadsheet deterministic parse: ${parsed.length} items extracted`);
            spreadsheetItems.push(...parsed);
          } catch (xlsErr) {
            console.error(`Spreadsheet parse error for ${url}:`, xlsErr);
          }
        } else if (isCsv) {
          hadSpreadsheetFiles = true;
          try {
            const res = await fetch(url);
            if (!res.ok) { console.error(`Failed to fetch CSV: ${url}`); continue; }
            const text = await res.text();
            // Parse CSV deterministically via XLSX
            const workbook = XLSX.read(text, { type: "string" });
            const parsed = parseSpreadsheetToItems(workbook);
            console.log(`CSV deterministic parse: ${parsed.length} items extracted`);
            spreadsheetItems.push(...parsed);
          } catch (csvErr) {
            console.error(`CSV parse error for ${url}:`, csvErr);
            // Fallback: send as text to AI
            try {
              const res = await fetch(url);
              if (res.ok) {
                const text = await res.text();
                contentParts.push({ type: "text", text: `[CSV DATA]\n${text.slice(0, 50000)}` });
                hadAIFiles = true;
              }
            } catch { /* skip */ }
          }
        } else if (isPdf) {
          hadAIFiles = true;
          try {
            const res = await fetch(url);
            if (!res.ok) { console.error(`Failed to fetch PDF: ${url} (${res.status})`); continue; }
            const bytes = new Uint8Array(await res.arrayBuffer());
            const b64 = arrayBufferToBase64(bytes);
            contentParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } });
            console.log(`PDF converted to base64: ${(bytes.length / 1024).toFixed(0)}KB`);
          } catch (fetchErr) {
            console.error(`PDF fetch/convert error for ${url}:`, fetchErr);
          }
        } else if (isImage) {
          hadAIFiles = true;
          contentParts.push({ type: "image_url", image_url: { url } });
        } else {
          // Unknown file type — skip, don't send as binary blob to AI
          console.log(`Skipping unsupported file type: ${url}`);
        }
      }

      // ─── AI extraction: only for PDF/image files ───
      if (hadAIFiles && contentParts.length > 0) {
        try {
        const extractionPrompt = `You are a senior Canadian rebar detailer and structural estimator. Analyze the uploaded structural/shop drawings OR estimation documents and extract ALL rebar reinforcement items.

${scope_context ? `Context: ${scope_context}` : ""}
${historicalContext}

## CANADIAN SHOP DRAWING NOTATION GUIDE

These drawings use RebarCAD notation common in Canadian rebar detailing. Key patterns:

### Mark Prefixes
- **LS** prefix (e.g. LS02, LS117, LS125): Straight bars (no bends)
- **AS** prefix (e.g. AS24, AS57, AS81): Straight bars (alternate series)
- **L** prefix (e.g. L1003, L1510, L2009): Bent shapes — the digits encode bar size (e.g. L15xx = 15M bar, L20xx = 20M bar)
- **A** prefix (e.g. A1505, A1552): Bent shapes (alternate series)

### Quantity Notation
- Simple: "5" means 5 pieces
- Layer multiplier: "2x11" means 2 layers x 11 bars = 22 total bars
- "4x2" means 4 sets x 2 bars = 8 total bars

### Bend Types (ACI/RebarCAD)
- **Type 2**: L-shape (90 degree hook on one end) — dimensions A, B
- **Type 3**: Cranked/Z-shape — dimensions A, B, C
- **Type 17**: U-bar/stirrup (hook both ends) — dimensions A, B
- **T1**: Custom trapezoidal — dimensions A through G
- **Straight (no type)**: Single dimension A = full length

### Position Codes
- BLL = Bottom Long-way Lower
- TUL = Top Upper-way Lower
- T&B = Top & Bottom
- SF/EF = Start Face / End Face
- EW = Each Way
- DWL = Dowel

### Spacing
- "@12\\"" means spaced at 12 inches = 305mm
- "@8\\"" means spaced at 8 inches = 203mm

### Dimensions
- All dimensions are in imperial (feet-inches): 4'-2" = 1270mm, 30'-0" = 9144mm
- Convert ALL dimensions to millimeters for output

## TABULAR ESTIMATION FILES
If the document is a spreadsheet, table-format bar schedule, or estimation bid document (not a drawing):
- Extract items from the table rows
- Common columns: Mark, Bar Size, No. of Bars/Qty, Cut Length, Shape/Bend Type, Element, Drawing Ref, Weight
- Map each row to the same output JSON format below
- If bar sizes use imperial (#4, #5, #6...), convert: #3=10M, #4=15M, #5=15M, #6=20M, #7=25M, #8=25M, #9=30M, #10=30M, #11=35M
- If lengths are in feet-inches, convert to mm

## WEIGHT SUMMARY / ESTIMATE SUMMARY DOCUMENTS
If the document is a weight summary report or estimate summary (contains tables like "Weight Summary Report", "Element wise Summary", "Grand Total (Kgs/Tons)", or overall bar-size weight totals WITHOUT individual bar marks/cut-lengths):
- This is NOT a detailed bar schedule — it contains aggregated weights only
- Create ONE item per element per bar size combination found in the document
- For each element row (e.g. "RAFT SLAB: 27201.09 kg"), create items distributing the weight proportionally across bar sizes based on the bar size weight table in the document
- If only total weights per bar size are given (no per-element breakdown by size), create one item per bar size with the total weight
- Set mark to "SUM-{element_abbrev}-{bar_size}" (e.g. "SUM-RS-15M", "SUM-WALL-20M", "SUM-GB-15M")
  Element abbreviations: RAFT SLAB to RS, WALL to WALL, GRADE BEAMS to GB, PIERS to PIER, COLUMN to COL, SLAB to SL, FOOTING to FT, STAIR to ST
- Set quantity to 1
- Set shape_code to "straight"
- Calculate cut_length_mm from weight: weight_kg / mass_kg_per_m * 1000
  Use approximate mass per meter: 10M=0.785, 15M=1.570, 20M=2.355, 25M=3.925, 30M=5.495, 35M=7.850 kg/m
- Set element_type from the element name (RAFT SLAB to "slab", WALL to "wall", GRADE BEAMS to "grade_beam", PIERS to "pier", COLUMN to "column", FOOTING to "footing", STAIR to "stair")
- Set element_ref from the element name as shown in document
- Set weight_kg directly from the document's stated weight for that row
- CRITICAL: Preserve the exact weights from the document — do not recalculate them
- hook_type_near: "none", hook_type_far: "none", lap_type: "none", num_laps: 0, spacing_mm: null, bend_type: null, position: null, drawing_ref: null

## EXTRACTION INSTRUCTIONS

For each rebar callout found on the drawings, extract:
- element_type: "footing", "column", "beam", "slab", "wall", "pier", "grade_beam", "retaining_wall", "stair", "pool_slab", "pool_deck"
- element_ref: structural element reference label (e.g. W6, W7, GB1, F1, SD29)
- mark: the bar mark as shown (e.g. LS02, L1510, A1505, AS24)
- bar_size: Canadian metric size (10M, 15M, 20M, 25M, 30M, 35M)
- quantity: TOTAL number of bars after resolving multipliers (e.g. "2x11" = 22)
- cut_length_mm: total length in mm (convert from imperial feet-inches)
- hook_type_near: "90", "180", or "none"
- hook_type_far: "90", "180", or "none"
- lap_type: "tension", "compression", or "none"
- num_laps: number of lap splices (0 if none)
- spacing_mm: spacing in mm if applicable (convert from inches), null if not specified
- shape_code: "straight", "L-shape", "U-bar", "stirrup", "cranked", "trapezoidal", "dowel"
- bend_type: the RebarCAD bend type number if visible (2, 3, 17, T1, etc.) or null
- position: position code if visible (BLL, TUL, T&B, EW, etc.) or null
- drawing_ref: the drawing sheet reference (e.g. SD29, SD31, SD03)
- page_index: which uploaded file/page this item was found on (0-based index)
- bbox: bounding box of the rebar callout as {"x": float, "y": float, "w": float, "h": float} with normalized 0.0-1.0 coordinates relative to full page. x,y = top-left corner. Be precise — these will be used for colored overlays.
- weight_kg: if the document provides a weight value for this item, include it here. Otherwise omit or set to null.

## CRITICAL RULES
1. Convert ALL imperial dimensions to millimeters: 1 foot = 304.8mm, 1 inch = 25.4mm
2. Resolve ALL multipliers: "2x11" = 22 bars, "4x2" = 8 bars
3. For bent shapes, cut_length_mm = total developed length (sum of all dimensions A+B+C+...)
4. Extract EVERY single bar callout — do not skip any
5. If a bar appears on multiple drawing sheets, list each occurrence separately
6. For bbox: x=0.0 is left edge, x=1.0 is right, y=0.0 is top, y=1.0 is bottom

Return ONLY a valid JSON array of items. Do NOT wrap in markdown code fences.`;

        contentParts.push({ type: "text", text: extractionPrompt });

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [{ role: "user", content: contentParts }],
            max_tokens: 32000,
            temperature: 0.1,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error("AI gateway error:", aiRes.status, errText);
        } else {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content ?? "";
          console.log("AI extraction response length:", content.length);
          console.log("AI response preview:", content.substring(0, 500));

          let cleaned = content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

          // Repair truncated JSON arrays (salvage complete items)
          if (cleaned.startsWith("[") && !cleaned.trimEnd().endsWith("]")) {
            const lastBrace = cleaned.lastIndexOf("}");
            if (lastBrace > 0) {
              cleaned = cleaned.substring(0, lastBrace + 1) + "]";
              console.log("Repaired truncated JSON array");
            }
          }

          try {
            const parsed = JSON.parse(cleaned);
            extractedItems = Array.isArray(parsed) ? parsed : [parsed];
            console.log(`Extracted ${extractedItems.length} items (direct parse)`);
          } catch {
            const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                extractedItems = JSON.parse(jsonMatch[0]);
                console.log(`Extracted ${extractedItems.length} items (regex fallback)`);
              } catch (parseErr) {
                console.error("JSON parse failed after regex match:", parseErr);
              }
            } else {
              console.error("No JSON array found in AI response");
            }
          }

          // ─── STRICT USEFULNESS TEST ───
          const hasUsefulItem = extractedItems.some(item =>
            item.bar_size && MASS_PER_M[item.bar_size] &&
            (Number(item.weight_kg) > 0 || Number(item.cut_length_mm) > 0)
          );

          if (!hasUsefulItem) {
            console.log(`AI returned ${extractedItems.length} items but none are useful — running deterministic fallback`);
            let rescued = parseWeightSummaryFallback(content);
            if (rescued.length === 0) rescued = rescueAIItems(extractedItems);
            if (rescued.length === 0) rescued = parseWeightSummaryFallback(cleaned);
            if (rescued.length > 0) {
              console.log(`Deterministic fallback produced ${rescued.length} items`);
              extractedItems = rescued;
            }
          }
        }
        } catch (e) {
          console.error("AI vision extraction error:", e);
        }
      }

      // ─── MERGE: spreadsheet items take priority, then AI items ───
      if (spreadsheetItems.length > 0) {
        console.log(`Merging ${spreadsheetItems.length} spreadsheet items with ${extractedItems.length} AI items`);
        extractedItems = [...spreadsheetItems, ...extractedItems];
      }
    }

    // ─── 3. Deterministic Calculation ───
    let calculatedItems: EstimationItemResult[] = [];

    // Pre-filter: drop items with no bar_size before calculation
    const validItems = extractedItems.filter(item => item.bar_size && typeof item.bar_size === "string");
    if (validItems.length < extractedItems.length) {
      console.log(`Dropped ${extractedItems.length - validItems.length} items with missing bar_size`);
    }

    for (const input of validItems) {
      // Hardened null-safe defaults — catches null, undefined, NaN, empty strings
      input.quantity = Number(input.quantity) || 1;
      input.cut_length_mm = Number(input.cut_length_mm) || 0;

      const std = standardsMap.get(input.bar_size);
      if (!std) {
        calculatedItems.push({
          ...input,
          hook_type_near: input.hook_type_near ?? "none",
          hook_type_far: input.hook_type_far ?? "none",
          lap_type: input.lap_type ?? "none",
          hook_allowance_mm: 0,
          lap_allowance_mm: 0,
          total_length_mm: input.cut_length_mm,
          weight_kg: 0,
          unit_cost: 0,
          line_cost: 0,
          warnings: [`Unknown bar size: ${input.bar_size}`],
        });
        continue;
      }

      const p = pricingMap.get(input.bar_size);
      const result = calculateItem(input, std, p);

      // Preserve AI-provided weight when calculation produced zero (e.g. summary PDFs with no cut_length)
      const aiWeight = (input as any).weight_kg;
      if (aiWeight && aiWeight > 0 && result.weight_kg === 0) {
        result.weight_kg = Math.round(aiWeight * 1000) / 1000;
        const materialCost = p?.material_cost_per_kg ?? 0;
        result.unit_cost = Math.round(result.weight_kg * materialCost * 100) / 100;
        result.line_cost = Math.round(result.weight_kg * materialCost * 100) / 100;
      }

      result.warnings = validateItem(result, rules);
      calculatedItems.push(result);
    }

    if (waste_factor_pct > 0) {
      calculatedItems = applyWasteFactor(calculatedItems, waste_factor_pct);
    }

    // ─── 4. Compute summary ───
    const summary = computeProjectSummary(calculatedItems);

    // ─── ZERO-WEIGHT GUARD: Don't persist useless projects ───
    if (summary.total_weight_kg <= 0) {
      const fileTypes = [];
      if (hadSpreadsheetFiles) fileTypes.push("spreadsheet");
      if (hadAIFiles) fileTypes.push("PDF/image");
      const typeStr = fileTypes.join(" and ") || "uploaded";
      
      let errorMsg: string;
      if (hadSpreadsheetFiles && !hadAIFiles && spreadsheetItems.length === 0) {
        errorMsg = `Could not extract rebar data from the spreadsheet file. Ensure columns include Bar Size, Quantity, and Length/Weight. Supported formats: .xlsx, .xls, .csv.`;
      } else if (extractedItems.length === 0) {
        errorMsg = `No rebar data could be extracted from the ${typeStr} file(s). Please upload a rebar bar schedule, shop drawing, or weight summary report.`;
      } else {
        errorMsg = `Extracted ${extractedItems.length} items from ${typeStr} file(s) but computed total weight is zero. The file may not contain valid rebar data.`;
      }
      
      console.error(`Zero-weight guard triggered: ${errorMsg}`);
      return new Response(JSON.stringify({
        error: errorMsg,
        extraction_failed: true,
      }), { status: 422, headers: { "Content-Type": "application/json" } });
    }

    const totalLaborHours = pricing.length > 0
      ? calculatedItems.reduce((sum, item) => {
          const p = pricingMap.get(item.bar_size);
          if (!p || p.kg_per_labor_hour <= 0) return sum;
          return sum + item.weight_kg / p.kg_per_labor_hour;
        }, 0)
      : 0;

    // ─── 5. Persist ───
    const { data: project, error: projErr } = await supabaseAdmin
      .from("estimation_projects")
      .insert({
        name,
        customer_id: customer_id || null,
        lead_id: lead_id || null,
        status: extractedItems.length > 0 ? "completed" : "draft",
        source_files: file_urls.map((u: string) => ({ url: u })),
        element_summary: summary.element_summary,
        total_weight_kg: summary.total_weight_kg,
        total_cost: summary.total_cost,
        waste_factor_pct,
        labor_hours: Math.round(totalLaborHours * 100) / 100,
        created_by: userId,
        company_id: companyId,
      })
      .select("id")
      .single();

    if (projErr) {
      console.error("Project insert error:", projErr);
      return new Response(JSON.stringify({ error: "Failed to save project" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    // Insert items
    if (calculatedItems.length > 0) {
      const itemRows = calculatedItems.map((item) => ({
        project_id: project.id,
        element_type: item.element_type,
        element_ref: item.element_ref,
        mark: item.mark,
        bar_size: item.bar_size,
        grade: item.grade ?? "400W",
        shape_code: item.shape_code,
        quantity: Number(item.quantity) || 1,
        cut_length_mm: Number(item.cut_length_mm) || 0,
        total_length_mm: item.total_length_mm ?? 0,
        hook_allowance_mm: item.hook_allowance_mm ?? 0,
        lap_allowance_mm: item.lap_allowance_mm ?? 0,
        weight_kg: item.weight_kg ?? 0,
        spacing_mm: item.spacing_mm,
        dimensions: item.dimensions,
        unit_cost: item.unit_cost ?? 0,
        line_cost: item.line_cost ?? 0,
        source: "ai_extracted",
        warnings: item.warnings,
        bbox: (item as any).bbox ?? null,
        page_index: (item as any).page_index ?? 0,
      }));
      // Pre-filter: drop rows with invalid required fields
      const safeRows = itemRows.filter(r => r.quantity != null && r.quantity > 0 && r.bar_size);

      for (let i = 0; i < safeRows.length; i += 25) {
        const batch = safeRows.slice(i, i + 25);
        const { error: itemsErr } = await supabaseAdmin
          .from("estimation_items")
          .insert(batch);
        if (itemsErr) {
          console.error(`Items insert error (batch ${Math.floor(i / 25)}):`, itemsErr);
        }
      }
    }

    // ─── 6. Return ───
    return {
      success: true,
      project_id: project.id,
      summary: {
        ...summary,
        labor_hours: Math.round(totalLaborHours * 100) / 100,
        waste_factor_pct,
      },
      items: calculatedItems,
      warnings: calculatedItems.flatMap((i) => i.warnings),
    };
  }, { functionName: "ai-estimate", wrapResult: false })
);
