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
    let formality = "neutral";
    let contextHint = "";
    let outputFormat = "plain";
    let audioBase64 = "";
    let audioMime = "audio/mpeg";

    if (contentType.includes("multipart/form-data")) {
      // Audio upload mode
      const formData = await req.formData();
      mode = "audio";
      sourceLang = (formData.get("sourceLang") as string) || "auto";
      formality = (formData.get("formality") as string) || "neutral";
      contextHint = (formData.get("context") as string) || "";
      outputFormat = (formData.get("outputFormat") as string) || "plain";

      const audioFile = formData.get("audio") as File;
      if (!audioFile) return json({ error: "No audio file provided" }, 400);

      audioMime = audioFile.type || "audio/mpeg";
      const arrayBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Base64 encode
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      audioBase64 = btoa(binary);
    } else {
      // JSON text mode
      const body = await req.json();
      mode = body.mode || "text";
      text = body.text || "";
      sourceLang = body.sourceLang || "auto";
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

    let messages: any[];

    if (mode === "audio") {
      messages = [
        {
          role: "system",
          content: `You are an expert transcription and translation assistant. Transcribe the audio accurately, then translate it to English. ${langInstruction} ${formalityInstruction} ${formatInstruction} ${contextInstruction}

Respond ONLY with valid JSON in this exact format:
{"transcript":"<original transcribed text>","detectedLang":"<ISO language name e.g. Farsi, Spanish>","english":"<English translation>"}`
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
              text: "Transcribe this audio and translate to English. Return JSON only."
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: "system",
          content: `You are an expert translator. Detect the language of the input text and translate it to English. ${langInstruction} ${formalityInstruction} ${formatInstruction} ${contextInstruction}

Respond ONLY with valid JSON in this exact format:
{"original":"<original text>","detectedLang":"<ISO language name e.g. Farsi, Spanish>","english":"<English translation>"}`
        },
        {
          role: "user",
          content: text
        }
      ];
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      }
      if (aiResponse.status === 402) {
        return json({ error: "AI credits exhausted. Please add funds." }, 402);
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return json({ error: "AI processing failed" }, 500);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let parsed: any;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw as english
      parsed = mode === "audio"
        ? { transcript: rawContent, detectedLang: "unknown", english: rawContent }
        : { original: text, detectedLang: "unknown", english: rawContent };
    }

    return json(parsed);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("transcribe-translate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
