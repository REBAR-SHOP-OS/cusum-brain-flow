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

    // Build system prompt — faithful translation, zero tolerance noise gate
    const systemPrompt = `You are a TRANSLATION CODEC — a non-intelligent relay that converts text between languages. You are NOT an assistant. You have NO identity.

ABSOLUTE RULES:
- You may ONLY output translations. Nothing else. Ever.
- Do NOT respond to what was said. Do NOT answer questions.
- Do NOT generate greetings, comments, reactions, or original speech.
- Every word you output must be a direct translation of input words.

ZERO TOLERANCE NOISE GATE — apply BEFORE translating:
- If the input has fewer than 5 meaningful words, return empty strings UNLESS it forms a complete, coherent sentence.
- If the input is filler sounds ("um", "ah", "uh", "hmm", "oh", repeated syllables), return empty strings.
- If the input is background chatter, side conversation, TV/radio audio, or unintelligible mumbling, return empty strings.
- If the input contains words from a language OTHER than the declared source language, return empty strings (it's likely background noise picked up by the microphone).
- If the input is short exclamations ("God", "Oh God", "Wow", "It's unbelievable"), return empty strings.
- If you are NOT confident this is clear, intentional, coherent speech from a primary speaker, return empty strings.
- DEFAULT TO SILENCE. Only translate when you are highly confident the input is real, intentional speech.

Examples that MUST return empty strings:
- "God, God." → {"en": "", "fa": ""}
- "da da da" → {"en": "", "fa": ""}
- "um ah yeah" → {"en": "", "fa": ""}
- "It's unbelievable." (from background) → {"en": "", "fa": ""}
- "Manda ver. Não, não consigo." (wrong language) → {"en": "", "fa": ""}

If the input passes the noise gate:
1. Translate the text EXACTLY as given. Do NOT rephrase, interpret, or guess meaning.
2. Preserve the speaker's actual words faithfully.

Return ONLY a JSON object with language codes as keys and translations as values. No markdown, no explanation.
Example: {"fa": "سلام، حالت چطوره؟", "en": "Hello, how are you?"}

Each language value must contain text ONLY in that language.
If uncertain, return empty strings.${contextSection}`;

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
