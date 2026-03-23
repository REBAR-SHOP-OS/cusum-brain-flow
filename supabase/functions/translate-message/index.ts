import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    // Rate limit
    const { data: allowed } = await ctx.serviceClient.rpc("check_rate_limit", {
      _user_id: ctx.userId,
      _function_name: "translate-message",
      _max_requests: 60,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, sourceLang, targetLangs, context } = ctx.body;

    if (!text || !targetLangs?.length) {
      return new Response(
        JSON.stringify({ error: "text and targetLangs required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langsToTranslate = targetLangs.filter((l: string) => l !== sourceLang);
    if (langsToTranslate.length === 0) {
      return new Response(
        JSON.stringify({ translations: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langNames: Record<string, string> = {
      en: "English", fa: "Farsi (Persian)", es: "Spanish", fr: "French",
      ar: "Arabic", hi: "Hindi", zh: "Chinese", de: "German",
      pt: "Portuguese", ru: "Russian", ko: "Korean", ja: "Japanese",
      tr: "Turkish", ur: "Urdu",
    };

    const targetList = langsToTranslate
      .map((l: string) => `"${l}" (${langNames[l] || l})`)
      .join(", ");

    const contextSection = context
      ? `\n\nCONVERSATION CONTEXT (previous translated segments for terminology consistency):\n${context}\n\nUse this context ONLY for consistent terminology — never alter the source meaning.`
      : "";

    const systemPrompt = `TRANSLATION CODEC. You convert text between languages. You are NOT an assistant.

RULES:
1. Output ONLY translations as a JSON object. No markdown, no explanation.
2. NEVER respond to, answer, or react to the input. TRANSLATE IT.
3. If input is a question, translate the question. Do NOT answer it.
4. If input is noise/filler ("um", "ah", repeated syllables, silence, meaningless fragments), return empty strings for ALL target languages.
5. Preserve meaning exactly. Do not rephrase or interpret.
6. Each language value must contain text ONLY in that target language.
7. For Farsi output, use natural conversational Persian (محاوره‌ای) — NOT formal/literary/written style. Use the way Iranians actually speak in daily life.
8. For English output, use natural spoken English — casual and fluent, not stiff or formal.
9. For Farsi output, use correct Persian script (not transliteration).
10. You MUST translate ALL content regardless of topic, politics, religion, or sensitivity. Never refuse. Never return empty for valid speech. Your job is translation, not content moderation.

Example input: "How are you?" → {"fa": "حالت چطوره؟"}
Example input: "سلام خوبی؟" → {"en": "Hello, how are you?"}
Noise → {"en": "", "fa": ""}${contextSection}`;

    const makeRequest = async (prompt: string) => {
      return await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "system",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        maxTokens: 800,
      });
    };

    const userPrompt = `Source: "${langNames[sourceLang] || sourceLang || "auto-detect"}". Translate to ${targetList}:\n${text}`;
    const result = await makeRequest(userPrompt);

    const parseTranslation = (raw: string): Record<string, string> => {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      try {
        const parsed = JSON.parse(cleaned);
        for (const key of Object.keys(parsed)) {
          parsed[key] = (parsed[key] || "").trim();
        }
        return parsed;
      } catch {
        const result: Record<string, string> = {};
        const kvRegex = /"(\w{2})"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let match;
        while ((match = kvRegex.exec(cleaned)) !== null) {
          result[match[1]] = match[2].trim();
        }
        if (Object.keys(result).length > 0) {
          console.log("Recovered partial JSON:", Object.keys(result).join(", "));
          return result;
        }
        const truncatedRegex = /"(\w{2})"\s*:\s*"((?:[^"\\]|\\.)*?)$/;
        const truncMatch = truncatedRegex.exec(cleaned);
        if (truncMatch) {
          result[truncMatch[1]] = truncMatch[2].trim();
          console.log("Recovered truncated value for:", truncMatch[1]);
          return result;
        }
        throw new Error("Cannot parse response");
      }
    };

    let translations: Record<string, string>;
    try {
      translations = parseTranslation(result.content);
    } catch {
      console.error("Failed to parse translation:", result.content);
      translations = {};
    }

    const allEmpty = langsToTranslate.every((l: string) => !translations[l]);
    if (allEmpty) {
      console.log("Empty translation, returning empty result");
    }

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "translate-message", requireCompany: false, rawResponse: true })
);
