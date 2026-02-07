import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map file extensions to MIME types the AI gateway accepts
function getMimeType(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[ext] || "application/octet-stream";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

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

    // For any binary file (image, PDF, spreadsheet), fetch and send as base64 data URL
    if (isImage || isPdf || isSpreadsheet) {
      console.log(`Fetching file for AI: ${fileName} (${isSpreadsheet ? "spreadsheet" : isImage ? "image" : "pdf"})`);
      const fileResp = await fetch(fileUrl);
      if (!fileResp.ok) {
        throw new Error(`Failed to fetch file: ${fileResp.status}`);
      }
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
      ? "google/gemini-3-flash-preview"
      : (isImage || isPdf)
        ? "google/gemini-2.5-pro"
        : "google/gemini-3-flash-preview";

    console.log(`Using model: ${model} for file: ${fileName}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 32000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

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

    // Rebuild summary if it was lost due to truncation
    if (extractedData.items && !extractedData.summary) {
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
