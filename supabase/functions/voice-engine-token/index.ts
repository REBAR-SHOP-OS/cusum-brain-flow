import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders, json } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) throw new Error("GPT_API_KEY not configured");

    const {
      instructions = "You are a helpful assistant.",
      voice = "alloy",
      model = "gpt-4o-realtime-preview-2024-12-17",
      vadThreshold = 0.4,
      silenceDurationMs = 300,
      prefixPaddingMs = 200,
      temperature = 0.8,
    } = ctx.body;

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["audio", "text"],
        instructions,
        temperature,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: vadThreshold,
          prefix_padding_ms: prefixPaddingMs,
          silence_duration_ms: silenceDurationMs,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Realtime session error:", response.status, errText);
      return json({ error: "Failed to create realtime session" }, 500);
    }

    const sessionData = await response.json();
    const clientSecret = sessionData.client_secret?.value;

    if (!clientSecret) {
      console.error("No client_secret in response:", JSON.stringify(sessionData));
      return json({ error: "No client secret received" }, 500);
    }

    return { client_secret: clientSecret, expires_at: sessionData.client_secret?.expires_at };
  }, { functionName: "voice-engine-token", requireCompany: false, wrapResult: false })
);
