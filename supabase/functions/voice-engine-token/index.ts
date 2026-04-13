import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders, json } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) throw new Error("GPT_API_KEY not configured");

    const {
      instructions = "You are a fast, direct assistant. Answer in short sentences. Respond immediately.",
      voice = "sage",
      model = "gpt-4o-mini-realtime-preview-2025-06-03",
      vadThreshold = 0.45,
      silenceDurationMs = 250,
      prefixPaddingMs = 250,
      temperature = 0.6,
      maxOutputTokens = 120,
    } = ctx.body;

    const turnDetection: Record<string, unknown> = {
      type: "server_vad",
      threshold: vadThreshold,
      prefix_padding_ms: prefixPaddingMs,
      silence_duration_ms: silenceDurationMs,
    };

    const payload = JSON.stringify({
      model,
      voice,
      modalities: ["audio", "text"],
      instructions,
      temperature,
      max_response_output_tokens: maxOutputTokens,
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: turnDetection,
    });

    // ── TURN credentials served from backend secrets (not exposed in frontend) ──
    const TURN_USERNAME = Deno.env.get("METERED_TURN_USERNAME") || "1f355748924a8518adb04a1d";
    const TURN_CREDENTIAL = Deno.env.get("METERED_TURN_CREDENTIAL") || "Jk2Qk0D4BlbnSyB9";

    const turnServers = [
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: [
          "turn:global.relay.metered.ca:80",
          "turn:global.relay.metered.ca:80?transport=tcp",
          "turn:global.relay.metered.ca:443",
          "turns:global.relay.metered.ca:443?transport=tcp",
        ],
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      },
    ];
    console.log("[voice-engine-token] TURN credentials prepared (static)");

    const MAX_ATTEMPTS = 2;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GPT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: payload,
        });

        if (response.status >= 500) {
          const errText = await response.text();
          console.warn(`OpenAI ${response.status} (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`, errText);
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          return json({ error: "REALTIME_SESSION_UNAVAILABLE", fallback: true }, 200);
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenAI Realtime session error:", response.status, errText);
          return json({ error: "Failed to create realtime session", fallback: true }, 200);
        }

        const sessionData = await response.json();
        const clientSecret = sessionData.client_secret?.value;

        if (!clientSecret) {
          console.error("No client_secret in response:", JSON.stringify(sessionData));
          return json({ error: "No client secret received", fallback: true }, 200);
        }

        return {
          client_secret: clientSecret,
          expires_at: sessionData.client_secret?.expires_at,
          turn_servers: turnServers,
        };
      } catch (err) {
        console.error(`Unexpected error (attempt ${attempt + 1}):`, err);
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return json({ error: "SERVICE_FAILED", fallback: true }, 200);
      }
    }

    return json({ error: "Failed after retries", fallback: true }, 200);
  }, { functionName: "voice-engine-token", requireCompany: false, wrapResult: false })
);
