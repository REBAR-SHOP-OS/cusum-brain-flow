import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const DIARIZATION_INSTRUCTION = `
SPEAKER DIARIZATION:
- This audio/text may contain multiple speakers in a conversation.
- Identify each distinct speaker by voice characteristics (tone, pitch, accent, speaking style).
- Label them initially as "Speaker 1", "Speaker 2", etc.
- IMPORTANT: Listen carefully for when speakers address each other by name
  (e.g. "Hey Ali", "Thank you Sarah", "Mr. Johnson", etc.)
- If you detect a speaker's name, use their REAL NAME instead of "Speaker 1/2".
- If no name is detected for a speaker, keep "Speaker 1", "Speaker 2", etc.
- Format each line as: "SpeakerName: their words here"
- Maintain consistent speaker labels throughout the entire transcript.
- Include a "speakers" array in your response listing all identified speakers in order of appearance.
- If there is only ONE speaker, do NOT add speaker labels — just transcribe/translate normally and set speakers to a single-element array.`;

const TRANSLATOR_PERSONA = `You are a world-class professional translator and linguist with decades of experience. You produce translations indistinguishable from native human translators.

PRIMARY LANGUAGES: English, Farsi (Persian), Hindi, Georgian, Arabic, Turkish, Urdu. You also support ALL other languages.

COMPREHENSION FIRST:
- Before translating a SINGLE word, fully comprehend the speaker's meaning, intent, emotion, and cultural context in the SOURCE language.
- Only AFTER full comprehension, produce natural, humanized output that a native speaker would actually say in the same context.
- NEVER do surface-level word swaps — always convey the SPIRIT and INTENT of the original.

CRITICAL RULES:
- **CODE-SWITCHING / MIXED LANGUAGE**: Speakers commonly mix languages mid-sentence. This is code-switching and is COMPLETELY NORMAL. Treat ALL mixed-language input as one coherent message.
- Preserve ALL proper nouns, names, places, numbers, measurements, dates, and technical terms exactly as they appear
- Translate meaning and intent, NOT word-for-word
- NEVER hallucinate, add, or remove content that isn't in the original
- Maintain the original's register, emotion, and style

HUMANIZATION & WRITING STYLE:
- The output must sound like a real person wrote it — warm, clear, natural, and professional
- Produce clear, well-structured sentences with proper punctuation and grammar
- Eliminate filler words and verbal tics from translations
- Ensure the output reads like polished professional writing

${DIARIZATION_INSTRUCTION}`;

// ===== Post-processing system prompts =====
const POST_PROCESS_PROMPTS: Record<string, string> = {
  summarize: `You are an expert summarizer. Given the following transcript, produce a concise, well-structured summary that captures all key points, decisions, and important details. Use bullet points for clarity. Be thorough but concise.

Respond with the summary text only, no JSON wrapper.`,

  "action-items": `You are a project management expert. Given the following transcript, extract ALL actionable tasks, to-dos, and commitments made by participants.

For each action item, provide:
- **Task**: What needs to be done
- **Assignee**: Who is responsible (if mentioned, otherwise "Unassigned")
- **Priority**: High / Medium / Low (infer from context and urgency)
- **Deadline**: If mentioned, otherwise "TBD"

Format as a clean markdown list. Respond with the list only, no JSON wrapper.`,

  "meeting-notes": `You are a professional meeting notes writer. Given the following transcript, produce structured meeting notes with these sections:

## Key Points
- Main topics discussed

## Decisions Made
- Any decisions or agreements reached

## Action Items
- Tasks assigned with owners

## Follow-ups
- Items that need follow-up or further discussion

## Summary
- 2-3 sentence overview

Respond with the formatted notes only, no JSON wrapper.`,

  cleanup: `You are a professional editor. Given the following transcript, clean it up by:
1. Removing all filler words (um, uh, like, you know, I mean, so, basically)
2. Fixing grammar and punctuation
3. Improving sentence structure for clarity
4. Removing false starts and repetitions
5. Preserving ALL meaning and speaker intent
6. Maintaining speaker labels if present

Return the cleaned-up text only, no JSON wrapper.`,
};

function buildInstructions(langInstruction: string, targetInstruction: string, formalityInstruction: string, formatInstruction: string, contextInstruction: string) {
  return `${langInstruction} ${targetInstruction} ${formalityInstruction} ${formatInstruction} ${contextInstruction}`;
}

function buildAudioSystemPrompt(instructions: string, targetLang: string) {
  return `${TRANSLATOR_PERSONA}

${instructions}

Transcribe the audio accurately word-for-word with speaker labels if multiple speakers, then translate it. Respond ONLY with valid JSON:
{"transcript":"<original transcribed text>","detectedLang":"<primary language>","english":"<full translation into ${targetLang}>","speakers":["<speaker1>","<speaker2>"]}`;
}

function buildTextSystemPrompt(instructions: string, targetLang: string) {
  return `${TRANSLATOR_PERSONA}

${instructions}

Respond ONLY with valid JSON:
{"original":"<original text>","detectedLang":"<primary language>","english":"<full translation into ${targetLang}>","speakers":["<speaker1>","<speaker2>"]}`;
}

function buildPass2SystemPrompt(detectedLang: string, targetLang: string) {
  return `You are a senior translation quality reviewer. Reviewing a translation from ${detectedLang} to ${targetLang}.

Your job:
1. Rewrite awkward sentences into clean, publication-quality prose
2. Fix mistranslations, grammar errors, or unnatural expressions
3. Ensure proper nouns and technical terms are preserved
4. Rate quality 0-100

Respond ONLY with valid JSON:
{"refined":"<refined translation>","confidence":<number>,"notes":"<brief note>","speakers":["<speaker1>","<speaker2>"]}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req);
    // AI keys loaded via aiRouter

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
    let postProcess = "";
    let customPrompt = "";

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
      postProcess = body.postProcess || "";
      customPrompt = body.customPrompt || "";

      if (mode === "text" && !text.trim()) {
        return json({ error: "No text provided" }, 400);
      }
    }

    // ===== POST-PROCESSING MODE =====
    if (postProcess && text.trim()) {
      let systemPrompt: string;

      if (postProcess === "translate") {
        // Use the full translation pipeline below
      } else if (postProcess === "custom" && customPrompt.trim()) {
        systemPrompt = `You are a helpful AI assistant. The user has provided a transcript and wants you to process it according to their instructions.\n\nUser instruction: ${customPrompt}\n\nRespond with the processed text only, no JSON wrapper.`;
      } else if (POST_PROCESS_PROMPTS[postProcess]) {
        systemPrompt = POST_PROCESS_PROMPTS[postProcess];
      } else {
        return json({ error: `Unknown postProcess mode: ${postProcess}` }, 400);
      }

      if (postProcess !== "translate") {
        const ppMessages = [
          { role: "system", content: systemPrompt! },
          { role: "user", content: text },
        ];

        try {
          const ppResult = await callAI({
            provider: "gpt",
            model: "gpt-4o-mini",
            messages: ppMessages,
          });
          const result = ppResult.content || "";
          return json({ result, original: text, postProcess });
        } catch (aiErr) {
          if (aiErr instanceof AIError) {
            if (aiErr.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
            if (aiErr.status === 402) return json({ error: "AI credits exhausted. Please add funds." }, 402);
          }
          console.error("AI error (post-process):", aiErr);
          return json({ error: "AI processing failed" }, 500);
        }
      }
    }

    // ===== TRANSLATION MODE =====
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
    const instructions = buildInstructions(langInstruction, targetInstruction, formalityInstruction, formatInstruction, contextInstruction);

    let messages: any[];

    if (mode === "audio") {
      messages = [
        { role: "system", content: buildAudioSystemPrompt(instructions, targetLang) },
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
              text: `Transcribe this audio with speaker diarization and translate to ${targetLang}. Return JSON only.`
            }
          ]
        }
      ];
    } else {
      messages = [
        { role: "system", content: buildTextSystemPrompt(instructions, targetLang) },
        { role: "user", content: text }
      ];
    }

    // ===== PASS 1: Translate with gemini-2.5-pro =====
    let pass1Result;
    try {
      pass1Result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-pro",
        messages,
      });
    } catch (aiErr) {
      if (aiErr instanceof AIError) {
        if (aiErr.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
        if (aiErr.status === 402) return json({ error: "AI credits exhausted. Please add funds." }, 402);
      }
      console.error("AI error (pass 1):", aiErr);
      return json({ error: "AI processing failed" }, 500);
    }

    const rawContent = pass1Result.content;

    let parsed: any;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = mode === "audio"
        ? { transcript: rawContent, detectedLang: "unknown", english: rawContent, speakers: [] }
        : { original: text, detectedLang: "unknown", english: rawContent, speakers: [] };
    }

    // ===== PASS 2: Verify & refine =====
    const originalForReview = mode === "audio" ? (parsed.transcript || "") : (parsed.original || text);
    const translationForReview = parsed.english || "";

    const pass2Messages = [
      { role: "system", content: buildPass2SystemPrompt(parsed.detectedLang || "an unknown language", targetLang) },
      { role: "user", content: `Original text:\n${originalForReview}\n\nTranslation to review:\n${translationForReview}` }
    ];

    let confidence = 85;
    let refinedTranslation = translationForReview;
    let reviewNotes = "";
    let speakers = parsed.speakers || [];

    try {
      const pass2Result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-pro",
        messages: pass2Messages,
      });
      const pass2Raw = pass2Result.content;
      try {
        const pass2Cleaned = pass2Raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const pass2Parsed = JSON.parse(pass2Cleaned);
        refinedTranslation = pass2Parsed.refined || translationForReview;
        confidence = typeof pass2Parsed.confidence === "number" ? pass2Parsed.confidence : 85;
        reviewNotes = pass2Parsed.notes || "";
        if (Array.isArray(pass2Parsed.speakers) && pass2Parsed.speakers.length > 0) {
          speakers = pass2Parsed.speakers;
        }
      } catch {
        console.error("Pass 2 parse failed, using pass 1 result");
      }
    } catch (pass2Err) {
      console.error("Pass 2 failed:", pass2Err);
    }

    const result: any = {
      detectedLang: parsed.detectedLang || "unknown",
      english: refinedTranslation,
      confidence,
      reviewNotes,
      speakers: Array.isArray(speakers) ? speakers : [],
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
