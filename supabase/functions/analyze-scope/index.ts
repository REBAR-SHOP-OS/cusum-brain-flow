import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert ArrayBuffer to base64 in chunks to avoid stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_urls } = await req.json();
    if (!file_urls?.length) {
      return new Response(JSON.stringify({ error: "No file URLs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Take only 1 file to stay within memory limits
    const url = urls[0];
    const lower = url.toLowerCase();
    const isPdf = lower.includes(".pdf");
    const isImage = /\.(png|jpg|jpeg|webp|gif)/.test(lower);
    const imageParts: Array<{ type: string; image_url: { url: string } }> = [];

    if (isImage) {
      imageParts.push({ type: "image_url", image_url: { url } });
    } else if (isPdf) {
      // Fetch full PDF — must be complete for Gemini to parse pages
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const buf = await resp.arrayBuffer();
        // Skip if over 4MB to avoid memory crash
        if (buf.byteLength > 4 * 1024 * 1024) {
          console.warn("PDF too large, skipping base64 encode");
        } else {
          const b64 = arrayBufferToBase64(buf);
          imageParts.push({
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${b64}` },
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch PDF: ${url}`, e);
      }
    }

    if (imageParts.length === 0) {
      return new Response(JSON.stringify({
        scope: "Unable to analyze the uploaded files. Please describe the scope manually.",
        elements_found: [],
        confidence: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a rebar estimation expert analyzing structural drawings. Identify structural elements and recommend a scope of work for a reinforcing steel takeoff.

Return ONLY a JSON object with:
- "scope": Concise scope statement (1-2 sentences). Example: "Estimate all reinforcing steel for footings F1-F6, grade beams GB1-GB4, retaining walls W6-W10 per sheets SD-01 to SD-08"
- "elements_found": Array of element types found (e.g. ["footings", "grade beams", "retaining walls"])
- "confidence": Number 0-100

Focus on structural element types, marks/identifiers, sheet numbers, and project name from title block. Return ONLY valid JSON.`;

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
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze these structural drawings and recommend a scope of work for rebar estimation:" },
              ...imageParts,
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed: { scope: string; elements_found: string[]; confidence: number };
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { scope: content.trim(), elements_found: [], confidence: 50 };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-scope error:", e);
    return new Response(JSON.stringify({ error: e.message || "Analysis failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
