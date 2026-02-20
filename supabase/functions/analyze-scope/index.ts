import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Use Lovable AI gateway instead of downloading files to avoid memory limits
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Take first 3 file URLs
    const urls = (file_urls as string[]).slice(0, 3);

    // Build image_url parts pointing to public URLs (Gemini fetches them server-side)
    const imageParts = urls.map((url: string) => ({
      type: "image_url",
      image_url: { url },
    }));

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

    // Parse AI response
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
