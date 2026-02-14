import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
    .replace(/#{1,6}\s*/g, '')                // # headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // **bold**
    .replace(/\*([^*]+)\*/g, '$1')            // *italic*
    .replace(/^[\s]*[-*]\s/gm, '')            // bullet markers
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .trim();
}

function buildWavHeader(dataSize: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);    // PCM chunk size
  view.setUint16(20, 1, true);     // PCM format
  view.setUint16(22, 1, true);     // mono
  view.setUint32(24, 24000, true); // sample rate
  view.setUint32(28, 48000, true); // byte rate (24000 * 2)
  view.setUint16(32, 2, true);     // block align
  view.setUint16(34, 16, true);    // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  return new Uint8Array(header);
}

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

    const cleanText = stripMarkdown(text);
    const voice = voiceId || "Kore";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
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

    const pcmBytes = base64Decode(audioPart.data);
    
    // Always wrap in proper WAV header for browser compatibility
    const wavHeader = buildWavHeader(pcmBytes.length);
    const wavFile = new Uint8Array(wavHeader.length + pcmBytes.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(pcmBytes, wavHeader.length);

    return new Response(wavFile, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/wav",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("gemini-tts error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});
