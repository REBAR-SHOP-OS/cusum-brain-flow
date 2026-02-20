import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Take first 3 files to keep it fast
    const urls = file_urls.slice(0, 3) as string[];

    // Build image parts for Gemini vision
    const imageParts: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];
    
    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        
        // Determine mime type from URL or default
        let mime = "image/png";
        const lower = url.toLowerCase();
        if (lower.includes(".pdf")) mime = "application/pdf";
        else if (lower.includes(".jpg") || lower.includes(".jpeg")) mime = "image/jpeg";
        else if (lower.includes(".tif") || lower.includes(".tiff")) mime = "image/tiff";
        else if (lower.includes(".png")) mime = "image/png";

        // Convert to base64
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        const dataUrl = `data:${mime};base64,${b64}`;

        imageParts.push({ type: "image_url", image_url: { url: dataUrl } });
      } catch (e) {
        console.warn(`Failed to fetch file: ${url}`, e);
      }
    }

    if (imageParts.length === 0) {
      return new Response(JSON.stringify({ scope: "", elements_found: [], confidence: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a rebar estimation expert analyzing structural drawings. Your job is to identify what structural elements are shown and recommend a scope of work for a reinforcing steel takeoff.

Analyze the drawings and return a JSON object with:
- "scope": A concise scope statement (1-2 sentences) describing what to estimate. Example: "Estimate all reinforcing steel for footings F1-F6, grade beams GB1-GB4, retaining walls W6-W10, and pool slab PS1 per sheets SD-01 to SD-08"
- "elements_found": Array of structural element types found (e.g. ["footings", "grade beams", "retaining walls", "columns"])
- "confidence": A number 0-100 indicating how confident you are in the scope recommendation

Focus on:
- Structural element types (footings, walls, beams, columns, slabs, piers, etc.)
- Element marks/identifiers if visible (F1, W6, GB3, etc.)
- Sheet numbers and revision info
- Project name/address from title block if visible

Return ONLY valid JSON, no markdown.`;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
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
      maxTokens: 1000,
      temperature: 0.1,
    });

    // Parse AI response
    let parsed: { scope: string; elements_found: string[]; confidence: number };
    try {
      const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { scope: result.content.trim(), elements_found: [], confidence: 50 };
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

