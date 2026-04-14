import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

/**
 * PersonaPlex Voice Proxy — Phase 1 scaffold.
 * 
 * Proxies text conversation to a PersonaPlex adapter API
 * and returns text + optional base64 audio.
 * 
 * Until the PersonaPlex adapter is deployed, this falls back
 * to the Lovable AI gateway (text-only, no audio).
 * 
 * Required secrets:
 *   PERSONAPLEX_API_URL  — e.g. "https://personaplex.local:8080"
 *   PERSONAPLEX_API_KEY  — API key for the adapter
 *   LOVABLE_API_KEY      — fallback LLM (auto-provisioned)
 */

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { messages, systemPrompt, voiceEnabled = true } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const PERSONAPLEX_API_URL = (Deno.env.get("PERSONAPLEX_API_URL") || "").trim();
    const PERSONAPLEX_API_KEY = (Deno.env.get("PERSONAPLEX_API_KEY") || "").trim();

    // Validate: skip if URL is empty, contains variable name prefix, or points to our own project
    const isValidPersonaPlexUrl = PERSONAPLEX_API_URL
      && !PERSONAPLEX_API_URL.includes("PERSONAPLEX_API_URL")
      && !PERSONAPLEX_API_URL.includes("supabase.co/functions")
      && PERSONAPLEX_API_KEY;

    console.log("[personaplex-voice] PersonaPlex valid:", !!isValidPersonaPlexUrl, "URL set:", !!PERSONAPLEX_API_URL);

    // ── PersonaPlex path (when adapter is deployed) ──
    if (isValidPersonaPlexUrl) {
      try {
        const ppResponse = await fetch(`${PERSONAPLEX_API_URL}/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": PERSONAPLEX_API_KEY,
          },
          body: JSON.stringify({
            system_prompt: systemPrompt || "You are Vizzy, an executive AI assistant.",
            messages,
            options: { voice_enabled: voiceEnabled, max_tokens: 200 },
          }),
        });

        if (!ppResponse.ok) {
          const errText = await ppResponse.text();
          console.error("PersonaPlex error:", ppResponse.status, errText);

          // Fall through to Lovable AI fallback on 5xx
          if (ppResponse.status >= 500) {
            console.warn("PersonaPlex 5xx — falling back to Lovable AI");
          } else {
            return new Response(
              JSON.stringify({ error: `PersonaPlex error: ${ppResponse.status}` }),
              { status: ppResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } else {
          const data = await ppResponse.json();
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        console.error("PersonaPlex connection failed:", err);
        console.warn("Falling back to Lovable AI");
      }
    }

    // ── Lovable AI fallback (text-only, no audio) ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Neither PersonaPlex nor LOVABLE_API_KEY configured");

    const allMessages = [
      { role: "system", content: systemPrompt || "You are Vizzy, an executive AI assistant." },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: allMessages,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Lovable AI fallback error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `AI fallback error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    // Generate audio via ElevenLabs TTS so the client always gets audio
    let audio_base64: string | null = null;
    let audio_format: string | null = null;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (text && ELEVENLABS_API_KEY) {
      try {
        const speakable = text
          .replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "")
          .replace(/\[UNCLEAR\]/g, "")
          .trim();

        if (speakable) {
          const ttsResp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: speakable,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.35,
                  similarity_boost: 0.80,
                  style: 0.55,
                  use_speaker_boost: true,
                },
              }),
            }
          );

          if (ttsResp.ok) {
            const audioBuffer = await ttsResp.arrayBuffer();
            audio_base64 = base64Encode(audioBuffer);
            audio_format = "mp3";
            console.log("[personaplex-voice] TTS audio generated, size:", audioBuffer.byteLength);
          } else {
            console.error("[personaplex-voice] ElevenLabs TTS failed:", ttsResp.status);
          }
        }
      } catch (ttsErr) {
        console.error("[personaplex-voice] TTS error:", ttsErr);
      }
    }

    return new Response(
      JSON.stringify({ text, audio_base64, audio_format, _fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, { functionName: "personaplex-voice", authMode: "required", requireCompany: false, rawResponse: true })
);
