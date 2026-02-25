import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

// ... keep existing code (getMimeType function)

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

    // AI keys loaded via aiRouter
    const { fileUrl, fileName, manifestContext } = await req.json();
    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "fileUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fileName || fileUrl);
    const isPdf = /\.pdf$/i.test(fileName || fileUrl);
    const isSpreadsheet = /\.(xlsx?|csv)$/i.test(fileName || fileUrl);

    // Build the prompt for AI extraction
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
- Dimensions (A,B,C,...) are in millimeters
- If a dimension column is empty, use null
- "type" is the ASA shape code (1-32, S1-S15, T1-T17, COIL, X, Y, etc.)
- Items with no shape type are straight bars
- Always try to detect customer name, project reference, and site address from the document context
- If the document is a rebar bending schedule, bar list, or cut list, map ALL columns to the template above`;

    const contextInfo = manifestContext
      ? `\n\nManifest context provided by user:\n- Manifest Name: ${manifestContext.name}\n- Customer: ${manifestContext.customer}\n- Site Address: ${manifestContext.address}\n- Type: ${manifestContext.type}`
      : "";

    // Build message content
    const userContent: any[] = [
      {
        type: "text",
        text: `Extract all rebar schedule data from this uploaded file "${fileName || "document"}" and map to our label template.${contextInfo}\n\nReturn ONLY the JSON object, no markdown formatting.`,
      },
    ];

    // For spreadsheets, parse to CSV text and send as text content
    if (isSpreadsheet) {
      console.log(`Parsing spreadsheet: ${fileName}`);
      const fileResp = await fetch(fileUrl);
      if (!fileResp.ok) throw new Error(`Failed to fetch file: ${fileResp.status}`);
      const fileBytes = new Uint8Array(await fileResp.arrayBuffer());
      const workbook = XLSX.read(fileBytes, { type: "array" });

      // Convert all sheets to CSV
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
      // For images and PDFs, send as base64 data URL
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

    // Use flash for spreadsheets (fast, text-based), pro for vision tasks
    const model = isSpreadsheet
      ? "gemini-2.5-flash"
      : (isImage || isPdf)
        ? "gemini-2.5-pro"
        : "gemini-2.5-flash";

    console.log(`Using model: ${model} for file: ${fileName}`);

    let aiResult;
    try {
      aiResult = await callAI({
        provider: "gemini",
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        maxTokens: 32000,
      });
    } catch (aiErr) {
      if (aiErr instanceof AIError) {
        return new Response(
          JSON.stringify({ error: aiErr.message }),
          { status: aiErr.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw aiErr;
    }

    const rawContent = aiResult.content;

    // Parse the JSON from the response
    let extractedData;
    try {
      // Remove markdown code fences if present
      let jsonStr = rawContent
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      // Attempt to repair truncated JSON (token limit cut-off)
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
          throw new Error("Cannot repair truncated JSON");
        }
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: "Failed to parse extraction results",
          rawContent: rawContent.substring(0, 1000),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rebuild summary if it was lost due to truncation and flag it
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

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extract manifest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
