import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard — enforce authentication
    let rateLimitId: string;
    try {
      const auth = await requireAuth(req);
      rateLimitId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: rateLimitId,
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

    const { text, sourceLang, targetLangs, context } = await req.json();
    // targetLangs is an array of language codes like ["fa", "es", "en"]
    // context is an optional string of previous translated segments for coherence

    if (!text || !targetLangs?.length) {
      return new Response(
        JSON.stringify({ error: "text and targetLangs required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out source language from targets
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

    // Build context section for the prompt
    const contextSection = context
      ? `\n\nCONVERSATION CONTEXT (previous translated segments for terminology consistency):\n${context}\n\nUse this context ONLY for consistent terminology — never alter the source meaning.`
      : "";

    // Build system prompt — faithful translation, no reconstruction
    const systemPrompt = `You are a faithful translator. The input text comes from an automatic speech recognition system that has already transcribed the audio accurately.

Your job:
1. Translate the text EXACTLY as given into the requested target languages
2. Do NOT change, rephrase, interpret, or guess at what was "actually meant"
3. Do NOT reconstruct phonetic approximations into other languages — translate the words as they are
4. Ignore only pure noise artifacts like "[laughter]", "[background noise]", or replacement characters
5. Preserve the speaker's actual words faithfully in each translation

Return ONLY a JSON object with language codes as keys and translations as values. No markdown, no explanation.
Example: {"fa": "سلام، حالت چطوره؟", "en": "Hello, how are you?"}

IMPORTANT: Each language value must contain text ONLY in that language. The "en" value must be pure English. The "fa" value must be pure Farsi/Persian script. Never mix languages in a single value.
IMPORTANT: Translate faithfully — do not add, remove, or change the meaning of what was said.
IMPORTANT: If the input is completely unintelligible gibberish, noise artifacts, meaningless symbols, or has no recoverable speech content, return empty strings for ALL language keys (e.g., {"en": "", "fa": ""}). Do NOT fabricate content from noise.${contextSection}`;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "system",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `The source language is "${langNames[sourceLang] || sourceLang || "auto-detect"}". Translate into ${targetList}:\n\n${text}`,
        },
      ],
      temperature: 0.05,
    });

    const raw = result.content;
    let translations: Record<string, string>;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      translations = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse translation:", raw);
      translations = {};
    }

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    const status = error instanceof AIError ? error.status : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
