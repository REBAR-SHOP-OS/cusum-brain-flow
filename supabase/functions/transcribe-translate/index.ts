import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const contentType = req.headers.get("content-type") || "";

    let mode: string;
    let text = "";
    let sourceLang = "auto";
    let targetLang = "English";
    let formality = "neutral";
    let contextHint = "";
    let outputFormat = "plain";
    let audioBase64 = "";
    let audioMime = "audio/mpeg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      mode = "audio";
      sourceLang = (formData.get("sourceLang") as string) || "auto";
      targetLang = (formData.get("targetLang") as string) || "English";
      formality = (formData.get("formality") as string) || "neutral";
      contextHint = (formData.get("context") as string) || "";
      outputFormat = (formData.get("outputFormat") as string) || "plain";

      const audioFile = formData.get("audio") as File;
      if (!audioFile) return json({ error: "No audio file provided" }, 400);

      audioMime = audioFile.type || "audio/mpeg";
      const arrayBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      audioBase64 = btoa(binary);
    } else {
      const body = await req.json();
      mode = body.mode || "text";
      text = body.text || "";
      sourceLang = body.sourceLang || "auto";
      targetLang = body.targetLang || "English";
      formality = body.formality || "neutral";
      contextHint = body.context || "";
      outputFormat = body.outputFormat || "plain";

      if (mode === "text" && !text.trim()) {
        return json({ error: "No text provided" }, 400);
      }
    }

    const formalityInstruction = formality === "casual"
      ? "Use casual, informal tone."
      : formality === "formal"
      ? "Use formal, professional tone."
      : "Use neutral tone.";

    const formatInstruction = outputFormat === "bullets"
      ? "Format the translation as bullet points."
      : outputFormat === "paragraphs"
      ? "Format the translation in well-structured paragraphs."
      : "Return plain text.";

    const contextInstruction = contextHint
      ? `Context/domain: ${contextHint}. Use terminology appropriate to this domain.`
      : "";

    const langInstruction = sourceLang !== "auto"
      ? `The source language is ${sourceLang}.`
      : "Auto-detect the source language.";

    const targetInstruction = `Translate to ${targetLang}.`;

    // Enhanced system prompt for world-class accuracy
    const translatorPersona = `You are a world-class professional translator and linguist with decades of experience. You produce translations indistinguishable from native human translators.

CRITICAL RULES:
- **CODE-SWITCHING / MIXED LANGUAGE**: The speaker may freely mix multiple languages in a single sentence or passage (e.g. Farsi + English, Spanish + English, Arabic + French). This is called code-switching and is NORMAL. Do NOT get confused by it. Treat the entire input as one coherent message regardless of how many languages appear. Identify ALL languages present and note them (e.g. "Farsi/English mix"). Translate the ENTIRE message into the target language, preserving the speaker's intent.
- When English words/phrases appear inside non-English speech, they are intentional. Keep technical English terms as-is if they have no natural equivalent in the target language, otherwise translate them.
- Preserve ALL proper nouns, names, places, numbers, measurements, dates, and technical terms exactly as they appear
- Translate meaning and intent, NOT word-for-word. Handle idioms, metaphors, and cultural expressions naturally
- For names and places, keep the original and optionally add transliteration in parentheses
- NEVER hallucinate, add, or remove content that isn't in the original
- NEVER add explanatory notes unless specifically asked
- Maintain the original's register, emotion, and style
- For ambiguous terms, choose the interpretation most consistent with context`;

    let messages: any[];

    if (mode === "audio") {
      messages = [
        {
           role: "system",
           content: `${translatorPersona}

${langInstruction} ${targetInstruction} ${formalityInstruction} ${formatInstruction} ${contextInstruction}

IMPORTANT: The speaker may mix languages freely (e.g. Farsi and English in the same sentence). Transcribe EXACTLY what was said, preserving the mixed languages in the transcript. Then translate the full meaning into ${targetLang}.

Transcribe the audio accurately word-for-word, then translate it. Respond ONLY with valid JSON:
{"transcript":"<original transcribed text preserving all languages as spoken>","detectedLang":"<primary language or 'Farsi/English mix' etc>","english":"<full translation into ${targetLang}>"}`
        },
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: audioBase64,
                format: audioMime.includes("wav") ? "wav" : "mp3"
              }
            },
            {
              type: "text",
              text: `Transcribe this audio and translate to ${targetLang}. Return JSON only.`
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: "system",
           content: `${translatorPersona}

${langInstruction} ${targetInstruction} ${formalityInstruction} ${formatInstruction} ${contextInstruction}

IMPORTANT: The text may contain multiple languages mixed together (e.g. Farsi and English in the same sentence). This is code-switching and is intentional. Translate the ENTIRE message into ${targetLang}, understanding the meaning across all languages present.

Respond ONLY with valid JSON:
{"original":"<original text as-is>","detectedLang":"<primary language or 'Farsi/English mix' etc>","english":"<full translation into ${targetLang}>"}`
        },
        {
          role: "user",
          content: text
        }
      ];
    }

    // ===== PASS 1: Translate with gemini-2.5-pro =====
    const pass1Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
      }),
    });

    if (!pass1Response.ok) {
      if (pass1Response.status === 429) {
        return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      }
      if (pass1Response.status === 402) {
        return json({ error: "AI credits exhausted. Please add funds." }, 402);
      }
      const errText = await pass1Response.text();
      console.error("AI gateway error (pass 1):", pass1Response.status, errText);
      return json({ error: "AI processing failed" }, 500);
    }

    const pass1Data = await pass1Response.json();
    const rawContent = pass1Data.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = mode === "audio"
        ? { transcript: rawContent, detectedLang: "unknown", english: rawContent }
        : { original: text, detectedLang: "unknown", english: rawContent };
    }

    // ===== PASS 2: Verify & refine translation =====
    const originalForReview = mode === "audio" ? (parsed.transcript || "") : (parsed.original || text);
    const translationForReview = parsed.english || "";

    const pass2Messages = [
      {
        role: "system",
        content: `You are a senior translation quality reviewer and editor. You are reviewing a translation from ${parsed.detectedLang || "an unknown language"} to ${targetLang}.

Your job:
1. Check the translation for accuracy against the original
2. Fix any mistranslations, awkward phrasing, grammar errors, or unnatural expressions
3. Ensure proper nouns, numbers, and technical terms are preserved correctly
4. Ensure cultural idioms are translated naturally (meaning, not literal)
5. Rate the overall translation quality as a confidence score from 0-100:
   - 95-100: Perfect, publication-ready
   - 85-94: Excellent, minor stylistic preferences only
   - 70-84: Good, some improvements made
   - 50-69: Significant corrections needed
   - Below 50: Major issues found

Respond ONLY with valid JSON:
{"refined":"<refined translation>","confidence":<number 0-100>,"notes":"<brief note on what was changed, or 'No changes needed'>"}`
      },
      {
        role: "user",
        content: `Original text:\n${originalForReview}\n\nTranslation to review:\n${translationForReview}`
      }
    ];

    const pass2Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: pass2Messages,
      }),
    });

    let confidence = 85;
    let refinedTranslation = translationForReview;
    let reviewNotes = "";

    if (pass2Response.ok) {
      const pass2Data = await pass2Response.json();
      const pass2Raw = pass2Data.choices?.[0]?.message?.content || "";
      try {
        const pass2Cleaned = pass2Raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const pass2Parsed = JSON.parse(pass2Cleaned);
        refinedTranslation = pass2Parsed.refined || translationForReview;
        confidence = typeof pass2Parsed.confidence === "number" ? pass2Parsed.confidence : 85;
        reviewNotes = pass2Parsed.notes || "";
      } catch {
        // If pass 2 fails to parse, keep pass 1 result
        console.error("Pass 2 parse failed, using pass 1 result");
      }
    } else {
      console.error("Pass 2 failed:", pass2Response.status);
    }

    const result: any = {
      detectedLang: parsed.detectedLang || "unknown",
      english: refinedTranslation,
      confidence,
      reviewNotes,
    };

    if (mode === "audio") {
      result.transcript = parsed.transcript || "";
    } else {
      result.original = parsed.original || text;
    }

    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("transcribe-translate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
