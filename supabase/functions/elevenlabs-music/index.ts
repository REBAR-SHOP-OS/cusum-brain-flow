import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { prompt, duration, type } = body;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs API key not configured");
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSfx = type === "sfx";
    const apiUrl = isSfx
      ? "https://api.elevenlabs.io/v1/sound-generation"
      : "https://api.elevenlabs.io/v1/music";

    const reqBody = isSfx
      ? { text: prompt, duration_seconds: duration || 5, prompt_influence: 0.3 }
      : { prompt, duration_seconds: duration || 30 };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs ${isSfx ? "SFX" : "Music"} error:`, errorText);
      return new Response(JSON.stringify({ error: `${isSfx ? "SFX" : "Music"} generation failed` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  }, { functionName: "elevenlabs-music", authMode: "none", requireCompany: false, rawResponse: true })
);
