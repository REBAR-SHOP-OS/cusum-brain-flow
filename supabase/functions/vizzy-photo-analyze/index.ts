import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";

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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { imageUrl, prompt } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl required" }), { status: 400, headers: corsHeaders });
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

    // Gemini: vision/multimodal task
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    return new Response(JSON.stringify({ analysis: result.content || "Could not analyze image." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-photo-analyze error:", err);
    const status = err instanceof AIError ? err.status : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
