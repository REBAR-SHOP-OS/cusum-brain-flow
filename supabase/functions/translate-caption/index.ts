import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI } from "../_shared/aiRouter.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { caption, imageText } = ctx.body;

    if (!caption && !imageText) {
      return new Response(
        JSON.stringify({ error: "caption or imageText required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a professional Persian translator for construction & rebar industry marketing content.

RULES:
1. Translate to natural conversational Persian (محاوره‌ای) — NOT formal/literary style.
2. Use correct Persian script (not transliteration).
3. Output ONLY a JSON object with keys "captionFa" and "imageTextFa". No markdown, no explanation.
4. If a field is empty or missing, return empty string for that key.
5. Preserve marketing tone — keep it punchy and engaging.
6. Translate ALL content regardless of topic. Never refuse.`;

    const userPrompt = `Translate to Persian:

Caption: ${caption || "(none)"}

Image text: ${imageText || "(none)"}

Return JSON: {"captionFa": "...", "imageTextFa": "..."}`;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "translate-caption",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 1000,
    });

    let parsed: { captionFa?: string; imageTextFa?: string } = {};
    try {
      const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try regex fallback
      const capMatch = result.content.match(/"captionFa"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const imgMatch = result.content.match(/"imageTextFa"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = {
        captionFa: capMatch?.[1] || "",
        imageTextFa: imgMatch?.[1] || "",
      };
    }

    return new Response(
      JSON.stringify({ captionFa: parsed.captionFa || "", imageTextFa: parsed.imageTextFa || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "translate-caption", requireCompany: false, rawResponse: true })
);
