import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) return json({ error: "No audio file provided" }, 400);

    const languageCode = (formData.get("language_code") as string) || "";
    const diarize = formData.get("diarize") !== "false";

    const apiFormData = new FormData();
    apiFormData.append("file", audioFile);
    apiFormData.append("model_id", "scribe_v2");
    apiFormData.append("tag_audio_events", "true");
    apiFormData.append("diarize", String(diarize));
    if (languageCode) {
      apiFormData.append("language_code", languageCode);
    }

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: apiFormData,
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      const errText = await response.text();
      console.error("ElevenLabs transcribe error:", response.status, errText);
      return json({ error: "Transcription failed" }, 500);
    }

    const transcription = await response.json();
    return json(transcription);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("elevenlabs-transcribe error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
