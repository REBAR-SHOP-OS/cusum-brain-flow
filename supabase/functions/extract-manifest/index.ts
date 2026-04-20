import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// base64 encoding uses native btoa — no external import needed
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    pdf: "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

/** Convert Unicode fraction characters to decimal equivalents */
function normalizeFractions(input: string): string {
  const fractionMap: Record<string, string> = {
    '¼': '.25', '½': '.5', '¾': '.75',
    '⅛': '.125', '⅜': '.375', '⅝': '.625', '⅞': '.875',
    '⅓': '.333', '⅔': '.667', '⅕': '.2', '⅖': '.4', '⅗': '.6', '⅘': '.8',
    '⅙': '.167', '⅚': '.833',
  };
  let result = input;
  for (const [char, dec] of Object.entries(fractionMap)) {
    result = result.replaceAll(char, dec);
  }
  // Collapse whitespace around decimal (e.g. "9 .25" → "9.25")
  result = result.replace(/(\d)\s+(\.\d)/g, '$1$2');
  return result;
}

/** Parse a dimension value that may be imperial (e.g. "0'-4\"", "8'-9 ¼\"") or numeric. Returns a number or null. */
function parseDimension(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val !== "string") return null;

  // Normalize Unicode fractions first (¼→.25, ½→.5, etc.)
  const s = normalizeFractions(val.trim());
  if (!s) return null;

  // Imperial: X'-Y" or X' Y" or X'-Y or X' Y  (Y can be decimal like 9.25)
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*['']\s*-?\s*(\d+(?:\.\d+)?)\s*["""]?\s*$/);
  if (ftIn) {
    return parseFloat(ftIn[1]) * 12 + parseFloat(ftIn[2]);
  }

  // Feet only: "6'"
  const ftOnly = s.match(/^(\d+(?:\.\d+)?)\s*['']\s*$/);
  if (ftOnly) {
    return parseFloat(ftOnly[1]) * 12;
  }

  // Inches only: '4"'
  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*["""]?\s*$/);
  if (inOnly) {
    const n = parseFloat(inOnly[1]);
    return isNaN(n) ? null : n;
  }

  // Plain number — try ft-in pattern in the stripped string as safety net
  const stripped = s.replace(/[^0-9.'\-"]/g, "");
  const ftInFallback = stripped.match(/^(\d+(?:\.\d+)?)['\-](\d+(?:\.\d+)?)/);
  if (ftInFallback) {
    return parseFloat(ftInFallback[1]) * 12 + parseFloat(ftInFallback[2]);
  }

  const n = parseFloat(stripped.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

const DIMS = ["A","B","C","D","E","F","G","H","J","K","O","R"] as const;

/** Normalize a header cell to a single dimension letter (A-R), handling "DIM A", "Dim. B", "A (FT-IN)", etc. */
function normalizeDimHeader(raw: string): string | null {
  let s = String(raw).trim().toUpperCase();
  // Strip parenthesized unit suffixes like "(FT-IN)", "(MM)", "(IN)" first
  s = s.replace(/\s*\(.*?\)\s*/g, " ").trim();
  // Strip leading "DIM" or "DIM."
  s = s.replace(/^DIM\.?\s*/i, "").trim();
  // Must be exactly a single letter after cleanup — do NOT strip digits
  // This prevents "R1" from matching as "R"
  if (s.length === 1 && /^[A-Z]$/.test(s) && (DIMS as readonly string[]).includes(s)) return s;
  return null;
}

/** Extract dimension columns deterministically from XLSX sheet, bypassing AI.
 *  Also captures exact source cell text into __source_dims and __source_length.
 *  Returns { items, headersImperial } so the caller can use header-based unit detection. */
function overlaySheetDims(workbook: any, items: any[]): { items: any[], headersImperial: boolean, overlayApplied: boolean } {
  try {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    // Find header row containing dimension letters (exact or prefixed with DIM, with optional unit suffixes)
    const hIdx = rows.findIndex((r) =>
      r.some((c) => c != null && normalizeDimHeader(String(c)) !== null)
    );
    if (hIdx < 0) { console.log("[overlaySheetDims] No dim header row found"); return { items, headersImperial: false, overlayApplied: false }; }
    const hRow = rows[hIdx];

    // Detect if headers contain imperial unit hints like "(FT-IN)" or "(IN)"
    const headerLine = hRow.map((c: any) => String(c ?? "").toUpperCase()).join(" ");
    const headersHaveImperial = /\(FT[\s-]*IN\)|\(IN\)|\(INCH\)|FT-IN|FEET|INCHES/i.test(headerLine);
    if (headersHaveImperial) {
      console.log("[overlaySheetDims] Imperial unit detected from column headers");
    }
    const colMap: Record<string, number> = {};
    hRow.forEach((c: any, i: number) => {
      if (c == null) return;
      const letter = normalizeDimHeader(String(c));
      if (letter) colMap[letter] = i;
      // Also detect length column headers — strip parenthesized unit suffixes first
      const normalized = String(c).trim().toUpperCase()
        .replace(/\s*\(.*?\)\s*/g, " ")  // strip "(FT-IN)", "(MM)", etc.
        .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (["CUT LENGTH", "TOTAL LENGTH", "LENGTH", "CUTLENGTH", "CUT LEN", "TOT LENGTH"].includes(normalized)) {
        colMap["__LENGTH__"] = i;
      }
    });
    if (Object.keys(colMap).length < 2) { console.log("[overlaySheetDims] Only found", Object.keys(colMap).length, "dim columns, skipping"); return { items, headersImperial: headersHaveImperial, overlayApplied: false }; }
    console.log(`[overlaySheetDims] Found ${Object.keys(colMap).length} columns at header row ${hIdx}: ${JSON.stringify(colMap)}`);
    // Helper: get formatted display text (.w) from a sheet cell, falling back to raw value
    const getCellText = (sheetRow: number, col: number): string | null => {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c: col });
      const cell = sheet[addr];
      if (!cell) return null;
      // .w = formatted text (what user sees in Excel), .v = raw value
      return (cell.w != null ? String(cell.w) : String(cell.v)).trim();
    };

    console.log(`[overlaySheetDims] Processing ${items.length} items against ${rows.length} sheet rows`);
    const result = items.map((it, n) => {
      const row = rows[hIdx + 1 + n] || [];
      const sheetRow = hIdx + 1 + n; // 0-based row in the sheet
      const sourceDims: Record<string, string> = {};
      for (const d of DIMS) {
        if (colMap[d] != null) {
          const raw = row[colMap[d]];
          const cellText = getCellText(sheetRow, colMap[d]);
          sourceDims[d] = cellText ?? (raw != null ? String(raw).trim() : "");
          // Parse from formatted text first (preserves ft-in like 6'-3 ¼"),
          // fall back to raw only if text is unavailable
          const parseSource = cellText ?? (raw != null ? String(raw) : null);
          it[d] = parseSource != null ? (parseDimension(parseSource) ?? null) : null;
        }
      }
      it.__source_dims = sourceDims;
      // Overlay total_length from spreadsheet if found
      if (colMap["__LENGTH__"] != null) {
        const raw = row[colMap["__LENGTH__"]];
        const cellText = getCellText(sheetRow, colMap["__LENGTH__"]);
        it.__source_length = cellText ?? (raw != null ? String(raw).trim() : null);
        // Parse from formatted text first (preserves ft-in like 8'-9 ¼")
        const parseSource = cellText ?? (raw != null ? String(raw) : null);
        const parsed = parseSource != null ? parseDimension(parseSource) : null;
        if (parsed != null) it.total_length = parsed;
      }
      it.I = null;
      if (n < 3) console.log(`[overlaySheetDims] Row ${n}: sourceDims=${JSON.stringify(sourceDims)}, sourceLength=${it.__source_length}`);
      return it;
    });
    return { items: result, headersImperial: headersHaveImperial, overlayApplied: true };
  } catch (e) {
    console.warn("[overlaySheetDims] Failed, falling back to AI dims:", e);
    return { items, headersImperial: false, overlayApplied: false };
  }
}

/** Safe integer parse — rounds and guards against NaN */
function safeInt(val: any, fallback: number = 0): number {
  const parsed = parseDimension(val);
  if (parsed == null || isNaN(parsed)) return fallback;
  return Math.round(parsed);
}

/** Safe dimension parse — rounds to integer, returns null for empty/invalid */
function safeDim(val: any): number | null {
  const parsed = parseDimension(val);
  if (parsed == null || isNaN(parsed)) return null;
  return Math.round(parsed);
}

console.log("[extract-manifest] Function booted and handler registered");

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: svcClient, body } = ctx;

    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "extract-manifest",
      _max_requests: 5,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileUrl, fileName, manifestContext, sessionId } = body;
    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "fileUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch session company_id for denormalized column
    const { data: sessionData } = await svcClient
      .from("extract_sessions")
      .select("company_id")
      .eq("id", sessionId)
      .single();
    const sessionCompanyId = sessionData?.company_id || null;

    // Update session to extracting immediately
    console.log(`Starting extraction for session ${sessionId}`);
    const { error: statusErr } = await svcClient
      .from("extract_sessions")
      .update({ status: "extracting", progress: 0, error_message: null })
      .eq("id", sessionId);
    if (statusErr) console.error("Failed to update session status:", statusErr);
    else console.log(`Session ${sessionId} marked as extracting`);

    // Run extraction synchronously — edge function stays alive up to 150s
    try {
        await svcClient
          .from("extract_sessions")
          .update({ progress: 10 })
          .eq("id", sessionId);
        const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fileName || fileUrl);
        const isPdf = /\.pdf$/i.test(fileName || fileUrl);
        const isSpreadsheet = /\.(xlsx?|csv)$/i.test(fileName || fileUrl);

        const systemPrompt = `You are a rebar schedule extraction engine. Your job is to parse uploaded documents (PDFs, spreadsheets, images of drawings) and extract rebar bar-bending schedule data.

Output ONLY a valid JSON object with this structure:
{
  "items": [
    {
      "dwg": "drawing number",
      "item": "item number",
      "grade": "steel grade e.g. 400W",
      "mark": "mark number e.g. A1014",
      "quantity": number,
      "size": "bar size e.g. 10M, 15M, 20M",
      "type": "ASA shape type number e.g. 17, 21, 3, S13, or empty for straight",
      "total_length": number in mm,
      "A": number or null,
      "B": number or null,
      "C": number or null,
      "D": number or null,
      "E": number or null,
      "F": number or null,
      "G": number or null,
      "H": number or null,
      "I": null,
      "J": number or null,
      "K": number or null,
      "O": number or null,
      "R": number or null,
      "weight": number or null,
      "customer": "customer name",
      "ref": "reference code",
      "address": "site address"
    }
  ],
  "summary": {
    "total_items": number,
    "total_pieces": number,
    "bar_sizes_found": ["10M","15M",...],
    "shape_types_found": ["17","21",...],
    "customer": "detected customer name",
    "project": "detected project name"
  }
}

CRITICAL DIMENSION MAPPING RULE:
Rebar dimension columns SKIP the letter "I". The correct sequence is: A, B, C, D, E, F, G, H, J, K, O, R.
There is NO "I" dimension in rebar standards. The "I" field in the schema above is a placeholder — always set it to null.
If the source document has a column labeled "I", IGNORE its values completely. Do NOT shift dimension values.
Each dimension value MUST go into its EXACT matching letter field: the value under column "H" in the source goes into "H", the value under "J" goes into "J", etc. NEVER shift values from one letter to another.

CRITICAL: When processing spreadsheet/CSV data, each column's data must map to its HEADER LABEL exactly.
If the CSV has headers like: ..., A, B, C, D, E, F, G, H, I, J, K, ...
- Column header "A" value → field "A"
- Column header "B" value → field "B"
- Column header "H" value → field "H"
- Column header "I" → SKIP entirely (set "I": null)
- Column header "J" value → field "J" (NOT shifted into "I" or "H")
Match by HEADER NAME, not by column position index. DO NOT re-index or shift columns.

Rules:
- Extract ALL rows/items from the document
- Keep ALL numerical values EXACTLY as they appear in the source document. Do NOT convert units. If the document shows inches, keep inches. If it shows millimeters, keep millimeters. If a value is "3'-5\"", return it as the string "3'-5\\"" or as the numeric equivalent in the document's native units.
- Dimensions (A,B,C,...) and total_length should be the exact numbers from the source, with no unit conversion. For imperial ft-in values like 3'-5", return the raw string or the numeric inches value (e.g. 41).
- If a dimension column is empty, use null
- "type" is the ASA shape code (1-32, S1-S15, T1-T17, COIL, X, Y, etc.)
- Items with no shape type are straight bars
- Always try to detect customer name, project reference, and site address from the document context
- If the document is a rebar bending schedule, bar list, or cut list, map ALL columns to the template above`;

        const contextInfo = manifestContext
          ? `\n\nManifest context provided by user:\n- Manifest Name: ${manifestContext.name}\n- Customer: ${manifestContext.customer}\n- Site Address: ${manifestContext.address}\n- Type: ${manifestContext.type}`
          : "";

        const userContent: any[] = [
          {
            type: "text",
            text: `Extract all rebar schedule data from this uploaded file "${fileName || "document"}" and map to our label template.${contextInfo}\n\nReturn ONLY the JSON object, no markdown formatting.`,
          },
        ];

        // Parse file content
        await svcClient
          .from("extract_sessions")
          .update({ progress: 20 })
          .eq("id", sessionId);

        let parsedWorkbook: any = null;
        if (isSpreadsheet) {
          console.log(`Parsing spreadsheet: ${fileName}`);
          const fileResp = await fetch(fileUrl);
          if (!fileResp.ok) throw new Error(`Failed to fetch file: ${fileResp.status}`);
          const fileBytes = new Uint8Array(await fileResp.arrayBuffer());
          parsedWorkbook = XLSX.read(fileBytes, { type: "array", cellText: true });
          const workbook = parsedWorkbook;

          const csvParts: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              csvParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            }
          }
          const allCsv = csvParts.join("\n\n");
          console.log(`Parsed ${csvParts.length} sheet(s), ${allCsv.length} chars of CSV`);

          userContent.push({
            type: "text",
            text: `Here is the spreadsheet content as CSV:\n\n${allCsv}`,
          });
        } else if (isImage || isPdf) {
          console.log(`Fetching file for AI: ${fileName} (${isImage ? "image" : "pdf"})`);
          const fileResp = await fetch(fileUrl);
          if (!fileResp.ok) throw new Error(`Failed to fetch file: ${fileResp.status}`);
          const fileBytes = new Uint8Array(await fileResp.arrayBuffer());
          // Chunked btoa to avoid stack overflow on large files
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < fileBytes.length; i += chunkSize) {
            binary += String.fromCharCode(...fileBytes.subarray(i, i + chunkSize));
          }
          const b64 = btoa(binary);
          const mimeType = getMimeType(fileName || fileUrl);
          const dataUrl = `data:${mimeType};base64,${b64}`;

          userContent.push({
            type: "image_url",
            image_url: { url: dataUrl },
          });
        }

        const model = isSpreadsheet
          ? "gemini-2.5-pro"
          : (isImage || isPdf)
            ? "gemini-2.5-pro"
            : "gemini-2.5-flash";

        const maxTokens = isSpreadsheet ? 65000 : 32000;

        console.log(`Using model: ${model} for file: ${fileName}`);

        // AI call — this is the slow part
        await svcClient
          .from("extract_sessions")
          .update({ progress: 30 })
          .eq("id", sessionId);

        const aiResult = await callAI({
          provider: "gemini",
          model,
          agentName: "estimating",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          maxTokens,
          fallback: {
            provider: "gpt",
            model: "gpt-5",
          },
        });

        await svcClient
          .from("extract_sessions")
          .update({ progress: 70 })
          .eq("id", sessionId);

        const rawContent = aiResult.content;

        // Check finish_reason for truncation detection
        const finishReason = aiResult.raw?.choices?.[0]?.finish_reason;
        if (finishReason === "length" || finishReason === "MAX_TOKENS") {
          console.warn(`AI response TRUNCATED — finish_reason: ${finishReason}, model: ${model}, maxTokens: ${maxTokens}`);
        } else {
          console.log(`AI response complete — finish_reason: ${finishReason}`);
        }

        // Parse the JSON from the response
        let extractedData;
        let jsonStr = rawContent
          .replace(/^```json?\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();

        try {
          extractedData = JSON.parse(jsonStr);
        } catch {
          console.warn("Initial JSON parse failed, attempting multi-strategy truncation repair...");
          extractedData = null;

          // Strategy 1: Close after last complete item in "items" array
          if (!extractedData) {
            try {
              const lastCompleteItem = jsonStr.lastIndexOf("},");
              if (lastCompleteItem > 0) {
                const repaired = jsonStr.substring(0, lastCompleteItem + 1) + "]}";
                extractedData = JSON.parse(repaired);
                console.log(`Repair strategy 1 succeeded: recovered ${extractedData.items?.length || 0} items`);
              }
            } catch { /* try next */ }
          }

          // Strategy 2: Close after last complete "}" (item without trailing comma)
          if (!extractedData) {
            try {
              const lastBrace = jsonStr.lastIndexOf("}");
              if (lastBrace > 0) {
                // Check if we're inside the items array
                const itemsIdx = jsonStr.indexOf('"items"');
                if (itemsIdx > -1) {
                  const repaired = jsonStr.substring(0, lastBrace + 1) + "]}";
                  extractedData = JSON.parse(repaired);
                  console.log(`Repair strategy 2 succeeded: recovered ${extractedData.items?.length || 0} items`);
                }
              }
            } catch { /* try next */ }
          }

          // Strategy 3: Extract items array directly via regex
          if (!extractedData) {
            try {
              const itemsMatch = jsonStr.match(/"items"\s*:\s*\[([\s\S]*)/);
              if (itemsMatch) {
                let arrStr = "[" + itemsMatch[1];
                const lastBrace = arrStr.lastIndexOf("}");
                if (lastBrace > 0) {
                  arrStr = arrStr.substring(0, lastBrace + 1) + "]";
                  const items = JSON.parse(arrStr);
                  extractedData = { items };
                  console.log(`Repair strategy 3 succeeded: recovered ${items.length} items`);
                }
              }
            } catch { /* give up */ }
          }

          if (!extractedData) {
            throw new Error("Failed to parse AI extraction results after all repair strategies");
          }

          // Log truncation warning
          const recoveredCount = extractedData.items?.length || 0;
          const truncationNote = finishReason === "length" || finishReason === "MAX_TOKENS"
            ? ` (finish_reason: ${finishReason})`
            : "";
          await svcClient
            .from("extract_sessions")
            .update({ error_message: `Warning: AI response was truncated${truncationNote}. Recovered ${recoveredCount} items — some rows may be missing.` })
            .eq("id", sessionId);
        }

        // Rebuild summary if truncated
        if (extractedData.items && !extractedData.summary) {
          extractedData._truncated = true;
          const items = extractedData.items;
          const barSizes = [...new Set(items.map((i: any) => i.size).filter(Boolean))];
          const shapeTypes = [...new Set(items.map((i: any) => i.type).filter(Boolean))];
          extractedData.summary = {
            total_items: items.length,
            total_pieces: items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
            bar_sizes_found: barSizes,
            shape_types_found: shapeTypes,
            customer: items[0]?.customer || null,
            project: items[0]?.ref || null,
          };
        }

        // Save rows to DB
        let items = extractedData.items || [];

        // ── Unit detection on RAW strings BEFORE parseDimension strips marks ──
        let detectedUnitSystem = "mm";
        {
          const rawSample: string[] = [];
          for (const item of items.slice(0, 20)) {
            for (const key of ["total_length", "A", "B", "C", "D", "E", "F", "G", "H"]) {
              if (item[key] != null) rawSample.push(String(item[key]));
            }
          }
          // ft-inch pattern: e.g. 6'-4", 5' - 8"
          const ftInchPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]/;
          // standalone inch: e.g. 54" or 78"
          const inchOnlyPattern = /^\d+(?:\.\d+)?\s*["""]\s*$/;
          // standalone feet: e.g. 6'
          const feetOnlyPattern = /^\d+(?:\.\d+)?\s*['']\s*$/;

          if (rawSample.some((v) => ftInchPattern.test(v))) {
            detectedUnitSystem = "imperial";
            console.log("Detected ft-inch (imperial) unit system from raw AI values");
          } else if (rawSample.some((v) => inchOnlyPattern.test(v) || feetOnlyPattern.test(v))) {
            detectedUnitSystem = "in";
            console.log("Detected inch unit system from raw AI values");
          }
        }

        // Capture raw AI strings WITH unit symbols BEFORE parseDimension strips them
        items.forEach((item: any) => {
          // Only set if not already populated (spreadsheet overlay sets these earlier)
          if (item.__source_length == null && item.total_length != null) {
            item.__source_length = String(item.total_length);
          }
          if (item.__source_dims == null) {
            const rawDims: Record<string, string> = {};
            for (const d of DIMS) {
              if (item[d] != null) {
                rawDims[d] = String(item[d]);
              }
            }
            if (Object.keys(rawDims).length > 0) {
              item.__source_dims = rawDims;
            }
          }
        });

        // Post-AI pass: convert any string values in length/dims to numbers
        items.forEach((item: any) => {
          if (typeof item.total_length === "string") {
            item.total_length = parseDimension(item.total_length);
          }
          for (const d of DIMS) {
            if (typeof item[d] === "string") {
              item[d] = parseDimension(item[d]);
            }
          }
        });

        // Deterministic dimension overlay for spreadsheets — bypass AI for dim columns
        let headersIndicateImperial = false;
        let overlaySucceeded = false;
        if (isSpreadsheet && parsedWorkbook && items.length > 0) {
          console.log(`[extract-manifest] Applying deterministic dim overlay for ${items.length} items`);
          const overlayResult = overlaySheetDims(parsedWorkbook, items);
          items = overlayResult.items;
          headersIndicateImperial = overlayResult.headersImperial;
          overlaySucceeded = overlayResult.overlayApplied;
          console.log(`[extract-manifest] Overlay applied: ${overlaySucceeded}`);
        }

        // Header-based unit detection: if column headers say "(FT-IN)", trust that
        if (headersIndicateImperial && detectedUnitSystem === "mm") {
          detectedUnitSystem = "imperial";
          console.log("Detected imperial unit system from spreadsheet column headers (FT-IN)");
        }
        // Note: primary detection already ran above on raw strings

        // Secondary check: scan raw XLSX cells for ft-inch or standalone inch marks
        if (isSpreadsheet && parsedWorkbook && detectedUnitSystem === "mm") {
          try {
            const sheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            const sampleCells: string[] = [];
            for (const row of (rawRows as any[][]).slice(0, 50)) {
              for (const cell of row) {
                if (typeof cell === "string") sampleCells.push(cell);
              }
            }
            // ft-inch first: e.g. 6'-4", 0'-9"
            const ftInCellPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]/;
            if (sampleCells.some((c: string) => ftInCellPattern.test(c.trim()))) {
              detectedUnitSystem = "imperial";
              console.log("Detected ft-inch (imperial) unit system from raw XLSX cell values");
            } else if (sampleCells.some((c: string) => /^\d+(?:\.\d+)?\s*[""'']\s*$/.test(c.trim()))) {
              detectedUnitSystem = "in";
              console.log("Detected inch unit system from raw XLSX cell values");
            }
          } catch (e) {
            console.warn("Failed to scan raw XLSX cells for unit detection:", e);
          }
        }

        // Tertiary check: inspect XLSX cell number formats for inch marks (e.g. format 0" displays 78 as 78")
        if (isSpreadsheet && parsedWorkbook && detectedUnitSystem === "mm") {
          try {
            const sheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
            const cellKeys = Object.keys(sheet).filter(k => !k.startsWith("!"));
            const inchFmtPattern = /["\u201D]|['\u2019]\s*$/;
            const hasInchFormat = cellKeys.some(k => {
              const cell = sheet[k];
              return cell && typeof cell.z === "string" && inchFmtPattern.test(cell.z);
            });
            if (hasInchFormat) {
              detectedUnitSystem = "in";
              console.log("Detected inch unit system from XLSX cell number format codes");
            }
          } catch (e) {
            console.warn("Failed to scan XLSX number formats for unit detection:", e);
          }
        }

        await svcClient
          .from("extract_sessions")
          .update({ progress: 85, unit_system: detectedUnitSystem } as any)
          .eq("id", sessionId);

        // Conversion factor: if source is imperial (inches), convert to mm for storage
        const isImperial = detectedUnitSystem === "imperial" || detectedUnitSystem === "in";
        const toMm = isImperial ? 25.4 : 1;
        if (isImperial) {
          console.log(`[extract-manifest] Applying ×25.4 conversion (${detectedUnitSystem} → mm) for all dims and lengths`);
        }


        /** Convert a parsed dimension (which is in inches for imperial) to mm */
        const dimToMm = (val: any): number | null => {
          const v = safeDim(val);
          if (v == null) return null;
          return Math.round(v * toMm);
        };
        const lengthToMm = (val: any): number | null => {
          const v = safeInt(val, 0);
          if (!v) return null;
          return Math.round(v * toMm);
        };

        // Validation guard: if imperial but converted mm values look suspiciously small,
        // it means parseDimension returned raw numbers without unit marks.
        // In that case the values ARE already in source units (inches) and need ×25.4.
        // If toMm is already 25.4, this is fine. But if detection somehow missed imperial
        // and toMm=1, we catch it here.
        if (!isImperial && items.length > 0) {
          // Check if most dim/length values are suspiciously small (< 50) which would
          // be unusual for mm but normal for inches
          const sampleVals: number[] = [];
          for (const it of items.slice(0, 20)) {
            for (const k of ["total_length", "A", "B", "C", "D"]) {
              const v = it[k];
              if (typeof v === "number" && v > 0) sampleVals.push(v);
            }
          }
          if (sampleVals.length > 3) {
            const median = sampleVals.sort((a, b) => a - b)[Math.floor(sampleVals.length / 2)];
            // If median value < 50, these are likely inches not mm (no rebar dim is < 50mm)
            if (median < 50) {
              console.warn(`[extract-manifest] VALIDATION GUARD: median dim value is ${median} — too small for mm. Likely unnormalized imperial. Re-detecting as "in".`);
              detectedUnitSystem = "in";
              // Re-update session
              await svcClient
                .from("extract_sessions")
                .update({ unit_system: "in" } as any)
                .eq("id", sessionId);
            }
          }
        }

        // NO CONVERSION — store original values in their original units
        const finalToMm = 1;
        console.log(`[extract-manifest] Storing values in original units (unit_system=${detectedUnitSystem}). No conversion applied.`);

        /** Pass-through helpers — no conversion, just type safety */
        const finalDimToMm = (val: any): number | null => {
          const v = safeDim(val);
          if (v == null) return null;
          return Math.round(v * finalToMm);
        };
        const finalLengthToMm = (val: any): number | null => {
          const v = safeInt(val, 0);
          if (!v) return null;
          return Math.round(v * finalToMm);
        };

        let savedCount = 0;
        if (items.length > 0) {
          const rows = items.map((item: any, idx: number) => {
            // Strip "I" dimension if AI returned it — rebar standards skip "I"
            if (item.I != null) {
              console.warn(`Row ${idx + 1}: AI returned "I" dimension value (${item.I}) — ignoring per rebar standard`);
            }
            // Build source text from __source_dims / __source_length (set by overlaySheetDims for spreadsheets)
            const sourceDimsJson = item.__source_dims || null;
            const sourceLengthText = item.__source_length != null ? String(item.__source_length) : (item.total_length != null ? String(item.total_length) : null);
            return {
              session_id: sessionId,
              company_id: sessionCompanyId,
              row_index: idx + 1,
              dwg: item.dwg || null,
              item_number: String(item.item || idx + 1),
              grade: item.grade || null,
              mark: item.mark || null,
              quantity: safeInt(item.quantity, 0),
              bar_size: item.size || null,
              shape_type: item.type || null,
              total_length_mm: finalLengthToMm(item.total_length),
              dim_a: finalDimToMm(item.A),
              dim_b: finalDimToMm(item.B),
              dim_c: finalDimToMm(item.C),
              dim_d: finalDimToMm(item.D),
              dim_e: finalDimToMm(item.E),
              dim_f: finalDimToMm(item.F),
              dim_g: finalDimToMm(item.G),
              dim_h: finalDimToMm(item.H),
              dim_j: finalDimToMm(item.J),
              dim_k: finalDimToMm(item.K),
              dim_o: finalDimToMm(item.O),
              dim_r: finalDimToMm(item.R),
              weight_kg: parseDimension(item.weight),
              customer: item.customer || null,
              reference: item.ref || null,
              address: item.address || null,
              source_total_length_text: sourceLengthText,
              source_dims_json: sourceDimsJson,
              status: "raw",
            };
          });

          // Save all rows as-is — deduplication is handled post-extraction
          // via the advisory detect-duplicates flow with user confirmation
          const dedupedRows = rows.map((r, idx) => ({ ...r, row_index: idx + 1 }));
          savedCount = dedupedRows.length;
          console.log(`Rows to insert: ${savedCount}`);

          // Batch insert rows (50 at a time) to avoid edge function timeout
          const BATCH_SIZE = 50;
          for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
            const batch = dedupedRows.slice(i, i + BATCH_SIZE);
            const { error: insertErr } = await svcClient.from("extract_rows").insert(batch);
            if (insertErr) throw new Error(`Failed to save rows batch ${i}: ${insertErr.message}`);
            const pct = 85 + Math.round(((i + batch.length) / dedupedRows.length) * 14);
            await svcClient.from("extract_sessions").update({ progress: pct }).eq("id", sessionId);
          }
        }

        // Mark session as extracted
        await svcClient
          .from("extract_sessions")
          .update({
            status: "extracted",
            progress: 100,
            error_message: null,
          })
          .eq("id", sessionId);

        console.log(`Extraction complete for session ${sessionId}: ${savedCount} rows saved`);

    return new Response(
      JSON.stringify({ status: "extracted", sessionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    } catch (bgErr: any) {
        console.error(`Extraction failed for session ${sessionId}:`, bgErr);
        await svcClient
          .from("extract_sessions")
          .update({
            status: "error",
            error_message: bgErr instanceof Error ? bgErr.message : "Unknown extraction error",
            progress: 0,
          })
          .eq("id", sessionId);

    return new Response(
      JSON.stringify({ status: "error", sessionId, error: bgErr instanceof Error ? bgErr.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    }
  }, { functionName: "extract-manifest", requireCompany: false, wrapResult: false })
);
