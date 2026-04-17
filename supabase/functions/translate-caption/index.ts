import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI } from "../_shared/aiRouter.ts";

const LANG_MAP: Record<string, { name: string; nativeName: string; style: string }> = {
  fa: { name: "Persian", nativeName: "فارسی", style: "natural conversational Persian (محاوره‌ای) — NOT formal/literary style" },
  es: { name: "Spanish", nativeName: "Español", style: "natural conversational Spanish (Latin American)" },
  fr: { name: "French", nativeName: "Français", style: "natural conversational French" },
  ar: { name: "Arabic", nativeName: "العربية", style: "natural Modern Standard Arabic, conversational tone" },
  de: { name: "German", nativeName: "Deutsch", style: "natural conversational German" },
};

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { caption, imageText, targetLang } = ctx.body;
    const lang = (typeof targetLang === "string" && LANG_MAP[targetLang]) ? targetLang : "fa";
    const langInfo = LANG_MAP[lang];

    if (!caption && !imageText) {
      return new Response(
        JSON.stringify({ error: "caption or imageText required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a professional ${langInfo.name} translator for construction & rebar industry marketing content.

RULES:
1. Translate to ${langInfo.style}.
2. Use correct ${langInfo.name} script (not transliteration).
3. Output ONLY a JSON object with keys "captionTranslated" and "imageTextTranslated". No markdown, no explanation.
4. If a field is empty or missing, return empty string for that key.
5. Preserve marketing tone — keep it punchy and engaging.
6. Translate ALL content regardless of topic. Never refuse.`;

    const userPrompt = `Translate to ${langInfo.name} (${langInfo.nativeName}):

Caption: ${caption || "(none)"}

Image text: ${imageText || "(none)"}

Return JSON: {"captionTranslated": "...", "imageTextTranslated": "..."}`;

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

    let parsed: { captionTranslated?: string; imageTextTranslated?: string; captionFa?: string; imageTextFa?: string } = {};
    try {
      const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try regex fallback for both new and legacy keys
      const capMatch = result.content.match(/"captionTranslated"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
                       result.content.match(/"captionFa"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const imgMatch = result.content.match(/"imageTextTranslated"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
                       result.content.match(/"imageTextFa"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = {
        captionTranslated: capMatch?.[1] || "",
        imageTextTranslated: imgMatch?.[1] || "",
      };
    }

    const captionOut = parsed.captionTranslated ?? parsed.captionFa ?? "";
    const imageTextOut = parsed.imageTextTranslated ?? parsed.imageTextFa ?? "";

    return new Response(
      JSON.stringify({
        // New generic keys
        captionTranslated: captionOut,
        imageTextTranslated: imageTextOut,
        targetLang: lang,
        // Legacy keys for backward-compat (Persian-only callers)
        captionFa: lang === "fa" ? captionOut : "",
        imageTextFa: lang === "fa" ? imageTextOut : "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "translate-caption", requireCompany: false, rawResponse: true })
);
