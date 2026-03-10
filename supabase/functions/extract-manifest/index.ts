import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import * as XLSX from "npm:xlsx@0.18.5";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard — enforce authentication
    let rateLimitId: string;
    try {
      const auth = await requireAuth(req);
      rateLimitId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: rateLimitId,
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

    const { fileUrl, fileName, manifestContext, sessionId } = await req.json();
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
          ? "gemini-2.5-flash"
          : (isImage || isPdf)
            ? "gemini-2.5-pro"
            : "gemini-2.5-flash";

        const maxTokens = isSpreadsheet ? 16000 : 32000;

        console.log(`Using model: ${model} for file: ${fileName}`);

        // AI call — this is the slow part
        await svcClient
          .from("extract_sessions")
          .update({ progress: 30 })
          .eq("id", sessionId);

        const aiResult = await callAI({
          provider: "gemini",
          model,
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

        // Parse the JSON from the response
        let extractedData;
        let jsonStr = rawContent
          .replace(/^```json?\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();

        try {
          extractedData = JSON.parse(jsonStr);
        } catch {
          console.warn("Initial JSON parse failed, attempting truncation repair...");
          const lastCompleteItem = jsonStr.lastIndexOf("},");
          if (lastCompleteItem > 0) {
            jsonStr = jsonStr.substring(0, lastCompleteItem + 1) + "]}";
            extractedData = JSON.parse(jsonStr);
            console.log(`Repaired truncated JSON: recovered ${extractedData.items?.length || 0} items`);
          } else {
            throw new Error("Failed to parse AI extraction results");
          }
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
        await svcClient
          .from("extract_sessions")
          .update({ progress: 85 })
          .eq("id", sessionId);

        if (items.length > 0) {
          const rows = items.map((item: any, idx: number) => ({
            session_id: sessionId,
            row_index: idx + 1,
            dwg: item.dwg || null,
            item_number: String(item.item || idx + 1),
            grade: item.grade || null,
            mark: item.mark || null,
            quantity: item.quantity || 0,
            bar_size: item.size || null,
            shape_type: item.type || null,
            total_length_mm: item.total_length || null,
            dim_a: item.A || null,
            dim_b: item.B || null,
            dim_c: item.C || null,
            dim_d: item.D || null,
            dim_e: item.E || null,
            dim_f: item.F || null,
            dim_g: item.G || null,
            dim_h: item.H || null,
            dim_j: item.J || null,
            dim_k: item.K || null,
            dim_o: item.O || null,
            dim_r: item.R || null,
            weight_kg: item.weight || null,
            customer: item.customer || null,
            reference: item.ref || null,
            address: item.address || null,
            status: "raw",
          }));

          const { error: insertErr } = await svcClient.from("extract_rows").insert(rows);
          if (insertErr) throw new Error(`Failed to save rows: ${insertErr.message}`);
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
