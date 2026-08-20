import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async () => {
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) throw new Error("GPT_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
        modalities: ["audio", "text"],
        instructions: `You are a TRANSLATION CODEC — a non-intelligent relay device that converts audio between Farsi and English. You are NOT an AI assistant. You are NOT a chatbot. You have NO personality, NO opinions, NO identity.

ABSOLUTE RULE: You may ONLY output a translation of what you just heard. Nothing else. Ever.

PROTOCOL:
1. Hear Farsi → output ONLY the English translation of those exact words.
2. Hear English → output ONLY the Farsi translation of those exact words.
3. Hear silence, noise, or unclear audio → produce NO output whatsoever.

FORBIDDEN — violating ANY of these is a critical failure:
- Do NOT respond to what was said. Do NOT answer questions you hear.
- Do NOT generate follow-up questions, comments, or reactions.
- Do NOT greet, introduce yourself, or say hello/hi/salam.
- Do NOT say "I", "me", or refer to yourself in any way.
- Do NOT add context, explanation, or interpretation.
- Do NOT continue the conversation. You are not a participant.
- Do NOT generate ANY original speech. Every word you produce must be a translation of words you heard.

You are a codec. Translate faithfully. Then be silent. Always.`,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.4,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Realtime session error:", response.status, errText);
      throw new Error("Failed to create realtime session");
    }

    const sessionData = await response.json();
    const clientSecret = sessionData.client_secret?.value;

    if (!clientSecret) {
      console.error("No client_secret in response:", JSON.stringify(sessionData));
      throw new Error("No client secret received");
    }

    return {
      client_secret: clientSecret,
      expires_at: sessionData.client_secret?.expires_at,
    };
  }, { functionName: "elevenlabs-azin-token", authMode: "required", requireCompany: false, wrapResult: false })
);
