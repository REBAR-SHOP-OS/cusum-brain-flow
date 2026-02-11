import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { imageUrl, prompt } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl required" }), { status: 400, headers: corsHeaders });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    // Download the image and convert to base64
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

    const systemPrompt = `You are Vizzy, the CEO's AI assistant for a rebar fabrication shop (CUSUM/rebar.shop).
Analyze this photo from the shop floor. Identify:
- Any machine errors, damage, or safety issues
- Rebar tags, labels, or markings visible
- Production quality issues (bent angles, cut lengths, surface defects)
- Any equipment status indicators
Be specific and actionable. If you see a problem, suggest what to do.
If the user included a specific question, answer it directly.`;

    const userPrompt = prompt || "What do you see in this photo? Any issues or things I should know about?";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: `${systemPrompt}\n\nUser question: ${userPrompt}` },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Could not analyze image.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-photo-analyze error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
