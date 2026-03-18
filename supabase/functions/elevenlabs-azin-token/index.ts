import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json } from "../_shared/auth.ts";

/**
 * Mints an ephemeral OpenAI Realtime API token for the AZIN interpreter.
 * Uses GPT_API_KEY to create a session, returns the client_secret for WebRTC.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) throw new Error("GPT_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview",
        voice: "alloy",
        modalities: ["audio", "text"],
        instructions: `You are a real-time bidirectional interpreter between English and Farsi (Persian).

RULES:
- If the user speaks Farsi, respond ONLY with the English translation.
- If the user speaks English, respond ONLY with the Farsi translation.
- Never add explanations, greetings, or commentary.
- Preserve numbers, measurements, and proper nouns exactly.
- Be extremely fast. Respond instantly.
- Just translate. Nothing else.`,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
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

    return json({
      client_secret: clientSecret,
      expires_at: sessionData.client_secret?.expires_at,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("azin-token error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
