import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedField {
  field: string;
  value: string | number | null;
  confidence: number; // 0-100
}

interface ExtractionResult {
  documentType: string; // invoice, bill, estimate, credit_memo, sales_receipt, expense, payment, unknown
  overallConfidence: number;
  fields: ExtractedField[];
  warnings: string[];
  rawText?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetType = formData.get("targetType") as string | null; // optional hint

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = btoa(String.fromCharCode(...bytes));

    // Determine mime type
    let mimeType = file.type || "application/octet-stream";
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) mimeType = "application/pdf";
    else if (name.endsWith(".png")) mimeType = "image/png";
    else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (name.endsWith(".webp")) mimeType = "image/webp";
    else if (name.endsWith(".heic")) mimeType = "image/heic";
    else if (name.endsWith(".csv")) mimeType = "text/csv";
    else if (name.endsWith(".xlsx") || name.endsWith(".xls")) mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";
    const isSpreadsheet = mimeType.includes("spreadsheet") || mimeType === "text/csv" || name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");

    // For spreadsheets, we'll handle differently - just extract as text
    let textContent: string | null = null;
    if (mimeType === "text/csv") {
      textContent = new TextDecoder().decode(bytes);
    }

    const typeHint = targetType ? `The user expects this to be a "${targetType}" document.` : "";

    const systemPrompt = `You are a financial document AI extractor. Analyze the uploaded document and extract structured accounting data.

${typeHint}

RULES:
1. Identify the document type: invoice, bill, estimate, credit_memo, sales_receipt, expense, payment, or unknown.
2. Extract ALL relevant fields with a confidence score (0-100) for each.
3. If a field is clearly readable, confidence = 100. If partially visible or inferred, lower the confidence.
4. Common fields to extract:
   - doc_number (invoice/bill/estimate number)
   - customer_name or vendor_name (whoever the counterparty is)
   - date (transaction date, YYYY-MM-DD)
   - due_date (if applicable, YYYY-MM-DD)
   - expiry_date (for estimates, YYYY-MM-DD)
   - total_amount (numeric, no currency symbol)
   - tax_amount (if visible)
   - subtotal (if visible)
   - balance_due (remaining amount)
   - payment_method (if visible)
   - memo or notes
   - line_items (JSON array of {description, quantity, unit_price, amount})
5. For each field, set confidence based on how clearly it was extracted.
6. Add warnings for anything ambiguous.

You MUST respond with valid JSON matching this schema:
{
  "documentType": "invoice|bill|estimate|credit_memo|sales_receipt|expense|payment|unknown",
  "overallConfidence": <number 0-100>,
  "fields": [
    {"field": "<name>", "value": <string|number|null>, "confidence": <0-100>}
  ],
  "warnings": ["<string>"],
  "lineItems": [{"description": "", "quantity": 1, "unitPrice": 0, "amount": 0}]
}`;

    // Build message content
    const userContent: any[] = [];

    if (textContent) {
      userContent.push({
        type: "text",
        text: `Analyze this CSV/spreadsheet data and extract accounting records:\n\n${textContent.substring(0, 15000)}`,
      });
    } else if (isImage || isPdf) {
      userContent.push({
        type: "text",
        text: "Analyze this financial document image/PDF and extract all accounting data.",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    } else if (isSpreadsheet) {
      // For Excel files, send as base64 and ask Gemini to parse
      userContent.push({
        type: "text",
        text: "This is a spreadsheet file (Excel). Analyze it and extract accounting records.",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    } else {
      userContent.push({
        type: "text",
        text: `Analyze this file (${file.name}) and extract any accounting data. File content as base64: ${base64.substring(0, 5000)}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let extracted: ExtractionResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = (jsonMatch[1] || content).trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          error: "Could not parse document. Please try a clearer image or PDF.",
          rawResponse: content.substring(0, 500),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-document-import error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
