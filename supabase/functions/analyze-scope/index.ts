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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const urls = file_urls as string[];

    // Extract filenames from URLs for context
    const filenames = urls.map((u: string) => {
      try {
        const decoded = decodeURIComponent(u.split("/").pop() || u);
        // Strip timestamp prefix like "1771561615192_"
        return decoded.replace(/^\d+_/, "");
      } catch {
        return u.split("/").pop() || u;
      }
    });

    // Build content parts — use direct URLs for images only
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    contentParts.push({
      type: "text",
      text: `Analyze these structural drawing files and recommend a scope of work for rebar estimation.\n\nFile names uploaded:\n${filenames.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}\n\nBased on the file names, infer the project and structural scope. If the names contain sheet references, element types, or project info, use that to build a detailed scope.`,
    });

    // For image files, attach them for visual analysis (lightweight, no memory issue)
    for (const url of urls.slice(0, 3)) {
      const lower = url.toLowerCase();
      if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower)) {
        contentParts.push({ type: "image_url", image_url: { url } });
      }
    }

    const systemPrompt = `You are a rebar estimation expert. Based on the uploaded drawing file names (and any attached images), recommend a scope of work for a reinforcing steel takeoff.

Return ONLY a JSON object:
- "scope": Concise scope statement (1-2 sentences). Example: "Estimate all reinforcing steel for footings F1-F6, grade beams GB1-GB4, retaining walls W6-W10 per sheets SD-01 to SD-08"
- "elements_found": Array of likely structural element types (e.g. ["footings", "grade beams", "retaining walls", "columns", "slabs"])
- "confidence": Number 0-100 (lower if working only from filenames)

If you can see images, use visual details. If only filenames are available, make reasonable inferences from the project name and sheet references. Return ONLY valid JSON.`;

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
          { role: "user", content: contentParts },
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
