import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import * as XLSX from "npm:xlsx@0.18.5";
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

/** Parse a dimension value that may be imperial (e.g. "0'-4\"", "3'-6\"") or numeric. Returns a number or null. */
function parseDimension(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val !== "string") return null;

  const s = val.trim();
  if (!s) return null;

  // Imperial: X'-Y" or X' Y" or X'-Y or X' Y
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*['']\s*-?\s*(\d+(?:\.\d+)?)\s*["""]?\s*$/);
  if (ftIn) {
    return Math.round(parseFloat(ftIn[1]) * 12 + parseFloat(ftIn[2]));
  }

  // Feet only: "6'"
  const ftOnly = s.match(/^(\d+(?:\.\d+)?)\s*['']\s*$/);
  if (ftOnly) {
    return Math.round(parseFloat(ftOnly[1]) * 12);
  }

  // Inches only: '4"'
  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*["""]?\s*$/);
  if (inOnly) {
    const n = parseFloat(inOnly[1]);
    return isNaN(n) ? null : n;
  }

  // Plain number
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
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

Rules:
- Extract ALL rows/items from the document
- Keep ALL numerical values EXACTLY as they appear in the source document. Do NOT convert units. If the document shows inches, keep inches. If it shows millimeters, keep millimeters.
- Dimensions (A,B,C,...) and total_length should be the exact numbers from the source, with no unit conversion
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

        if (isSpreadsheet) {
          console.log(`Parsing spreadsheet: ${fileName}`);
          const fileResp = await fetch(fileUrl);
          if (!fileResp.ok) throw new Error(`Failed to fetch file: ${fileResp.status}`);
          const fileBytes = new Uint8Array(await fileResp.arrayBuffer());
          const workbook = XLSX.read(fileBytes, { type: "array" });

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
          const b64 = base64Encode(fileBytes);
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
          agentName: "estimation",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          maxTokens,
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
        const items = extractedData.items || [];

        // Detect unit system from AI response — check if values contain imperial patterns
        let detectedUnitSystem = "metric";
        const sampleValues: string[] = [];
        for (const item of items.slice(0, 10)) {
          for (const key of ["total_length", "A", "B", "C", "D", "E", "F", "G", "H"]) {
            if (item[key] != null) sampleValues.push(String(item[key]));
          }
        }
        const imperialPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]/;
        if (sampleValues.some((v) => imperialPattern.test(v))) {
          detectedUnitSystem = "imperial";
          console.log("Detected imperial unit system from AI response values");
        }

        await svcClient
          .from("extract_sessions")
          .update({ progress: 85, unit_system: detectedUnitSystem } as any)
          .eq("id", sessionId);

        if (items.length > 0) {
          const rows = items.map((item: any, idx: number) => {
            // Strip "I" dimension if AI returned it — rebar standards skip "I"
            if (item.I != null) {
              console.warn(`Row ${idx + 1}: AI returned "I" dimension value (${item.I}) — ignoring per rebar standard`);
            }
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
              total_length_mm: safeInt(item.total_length, 0) || null,
              dim_a: safeDim(item.A),
              dim_b: safeDim(item.B),
              dim_c: safeDim(item.C),
              dim_d: safeDim(item.D),
              dim_e: safeDim(item.E),
              dim_f: safeDim(item.F),
              dim_g: safeDim(item.G),
              dim_h: safeDim(item.H),
              dim_j: safeDim(item.J),
              dim_k: safeDim(item.K),
              dim_o: safeDim(item.O),
              dim_r: safeDim(item.R),
              weight_kg: parseDimension(item.weight),
              customer: item.customer || null,
              reference: item.ref || null,
              address: item.address || null,
              status: "raw",
            };
          });

          // Batch insert rows (50 at a time) to avoid edge function timeout
          const BATCH_SIZE = 50;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: insertErr } = await svcClient.from("extract_rows").insert(batch);
            if (insertErr) throw new Error(`Failed to save rows batch ${i}: ${insertErr.message}`);
            const pct = 85 + Math.round(((i + batch.length) / rows.length) * 14);
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

        console.log(`Extraction complete for session ${sessionId}: ${items.length} rows saved`);

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
  } catch (error) {
    console.error("Extract manifest error:", error);
    // Attempt to mark the session as errored so the UI doesn't show a blank screen
  }, { functionName: "extract-manifest", requireCompany: false, wrapResult: false })
);
