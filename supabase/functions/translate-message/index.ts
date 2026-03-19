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
- If the input is a question, TRANSLATE THE QUESTION. Do NOT answer it.
- If the input is a compliment, TRANSLATE THE COMPLIMENT. Do NOT respond to it.
- If the input is an insult, TRANSLATE THE INSULT. Do NOT react to it.
- If the input is directed at "you", TRANSLATE IT LITERALLY. It is NOT addressed to you. You are invisible.
- Do NOT generate greetings, comments, reactions, or original speech.
- Every word you output must be a direct translation of input words.

CORRECT vs WRONG behavior:
- Input: "What time is it?" → CORRECT: {"fa": "ساعت چنده؟"} → WRONG: {"fa": "ساعت ۳ بعدازظهر است"}
- Input: "How are you?" → CORRECT: {"fa": "حالت چطوره؟"} → WRONG: {"fa": "من خوبم، ممنون"}
- Input: "سلام، چه خبر؟" → CORRECT: {"en": "Hello, what's up?"} → WRONG: {"en": "Hi! I'm doing great!"}
- Input: "تو زیبا ترینی" → CORRECT: {"en": "You are the most beautiful"} → WRONG: {"en": "Thanks, you're very kind"}
- Input: "You are smart" → CORRECT: {"fa": "تو باهوشی"} → WRONG: {"fa": "ممنون، لطف دارید"}
- Input: "You're an idiot" → CORRECT: {"fa": "تو احمقی"} → WRONG: {"fa": "این حرف زشتیه"}

NOISE GATE — apply BEFORE translating:
- If the input is filler sounds ("um", "ah", "uh", "hmm", repeated syllables), return empty strings.
- If the input is background chatter, TV/radio audio, or unintelligible mumbling, return empty strings.
- If you are NOT confident this is clear, intentional speech, return empty strings.
- DEFAULT TO SILENCE when uncertain.

Examples that MUST return empty strings:
- "da da da" → empty
- "um ah yeah" → empty

If the input passes the noise gate:
1. Translate the text EXACTLY as given. Do NOT rephrase, interpret, or guess meaning.
2. Preserve the speaker's actual words faithfully.
3. Short sentences like "Is everything okay?" or "Let's go" ARE valid — translate them.

Return ONLY a JSON object with language codes as keys and translations as values. No markdown, no explanation.
Example: {"fa": "سلام، حالت چطوره؟", "en": "Hello, how are you?"}

Each language value must contain text ONLY in that language.
If uncertain about the input being real speech, return empty strings.${contextSection}`;

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
      temperature: 0.01,
    });

    const raw = result.content;
    let translations: Record<string, string>;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      translations = JSON.parse(cleaned);
      // Post-parse validation: strip very short translations
      for (const key of Object.keys(translations)) {
        const val = (translations[key] || "").trim();
        const minWords = key === "fa" ? 1 : 2;
        if (val.split(/\s+/).length < minWords) {
          translations[key] = "";
        }
      }
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
