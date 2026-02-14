import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Rate limit: 20 requests/minute
    const { data: allowed } = await serviceClient.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "elevenlabs-tts",
      _max_requests: 20,
      _window_seconds: 60,
    });
    if (!allowed) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return json({ error: "text is required" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "TTS not configured" }, 500);
    }

    const voice = voiceId || "Kore";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `TTS the following text verbatim, do not add any commentary:\n\n${text.trim()}` }] }],
          generationConfig: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: voice },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini TTS error:", response.status, errText);
      return json({ error: "TTS generation failed" }, 502);
    }

    const result = await response.json();
    const audioPart = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!audioPart?.data) {
      console.error("Gemini TTS: no audio in response");
      return json({ error: "TTS returned no audio" }, 502);
    }

    const audioBytes = base64Decode(audioPart.data);
    const mimeType = audioPart.mimeType || "audio/wav";

    return new Response(audioBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("gemini-tts error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});
