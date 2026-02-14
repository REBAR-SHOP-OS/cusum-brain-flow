import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"; // Roger

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

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return json({ error: "TTS not configured" }, 500);
    }

    const voice = voiceId || DEFAULT_VOICE_ID;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs error:", response.status, errText);
      return json({ error: "TTS generation failed" }, 502);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("elevenlabs-tts error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});
