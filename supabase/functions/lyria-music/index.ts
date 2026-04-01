import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { prompt, duration } = body;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const durationSeconds = Math.min(Math.max(duration || 30, 5), 60);

    console.log("Generating music via ElevenLabs:", { prompt: prompt.slice(0, 100), durationSeconds });

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        duration_seconds: durationSeconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Music API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Music generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  }, { functionName: "lyria-music", authMode: "required", requireCompany: false, rawResponse: true })
);
