import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

/**
 * PersonaPlex Voice Proxy
 *
 * Two voice paths:
 *
 *   PATH A — "personaplex"
 *     When PERSONAPLEX_API_URL points to a valid external adapter.
 *     Proxies conversation to PersonaPlex POST /v1/chat.
 *     Returns { text, audio_base64, audio_format, _voice_path: "personaplex" }.
 *
 *   PATH B — "lovable+elevenlabs"  (fallback)
 *     When no valid PersonaPlex adapter is configured.
 *     Uses Lovable AI for text generation + ElevenLabs TTS for audio.
 *     Returns { text, audio_base64, audio_format, _voice_path: "lovable+elevenlabs", _fallback: true }.
 *
 * PERSONAPLEX_API_URL validation:
 *   - Must be a non-empty string
 *   - Must NOT contain the literal "PERSONAPLEX_API_URL" (copy-paste error)
 *   - Must NOT point to *.supabase.co/functions (self-referencing)
 *   - Must start with "https://"
 *   - PERSONAPLEX_API_KEY must also be set
 *
 * If validation fails, PersonaPlex is skipped silently → fallback is used.
 *
 * Required secrets:
 *   PERSONAPLEX_API_URL  — external adapter base URL (e.g. "https://pp-adapter.example.com")
 *   PERSONAPLEX_API_KEY  — API key for the adapter
 *   LOVABLE_API_KEY      — fallback LLM (auto-provisioned)
 *   ELEVENLABS_API_KEY   — fallback TTS voice
 *
 * Security: authMode "required" — all callers must be authenticated.
 * Behavior: strictly read-only — never simulates or claims ERP actions.
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

    // ── Validate PersonaPlex URL ──
    const rawUrl = (Deno.env.get("PERSONAPLEX_API_URL") || "").trim();
    const rawKey = (Deno.env.get("PERSONAPLEX_API_KEY") || "").trim();

    const isValidPersonaPlex = rawUrl
      && rawKey
      && rawUrl.startsWith("https://")
      && !rawUrl.includes("PERSONAPLEX_API_URL")
      && !rawUrl.includes("supabase.co/functions");

    console.log(`[personaplex-voice] path: ${isValidPersonaPlex ? "personaplex" : "lovable+elevenlabs"}`);

    // ══════════════════════════════════════════════════════════════
    // PATH A — PersonaPlex adapter (external full-duplex voice API)
    // ══════════════════════════════════════════════════════════════
    if (isValidPersonaPlex) {
      try {
        const ppResponse = await fetch(`${rawUrl}/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": rawKey,
          },
          body: JSON.stringify({
            system_prompt: systemPrompt || "You are Vizzy, an executive AI assistant.",
            messages,
            options: { voice_enabled: voiceEnabled, max_tokens: 200 },
          }),
        });

        if (!ppResponse.ok) {
          const errText = await ppResponse.text();
          console.error("[PATH A] PersonaPlex error:", ppResponse.status, errText);

          // Fall through to PATH B on 5xx
          if (ppResponse.status >= 500) {
            console.warn("[PATH A] 5xx — falling through to PATH B");
          } else {
            return new Response(
              JSON.stringify({ error: `PersonaPlex error: ${ppResponse.status}` }),
              { status: ppResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } else {
          const data = await ppResponse.json();
          return new Response(
            JSON.stringify({ ...data, _voice_path: "personaplex" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (err) {
        console.error("[PATH A] PersonaPlex connection failed:", err);
        console.warn("[PATH A] Falling through to PATH B");
      }
    }

    // ══════════════════════════════════════════════════════════════
    // PATH B — Lovable AI (text) + ElevenLabs TTS (audio) fallback
    // ══════════════════════════════════════════════════════════════
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
      console.error("[PATH B] Lovable AI error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `AI fallback error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    // ── Generate audio via ElevenLabs TTS ──
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
            console.log("[PATH B] TTS audio generated, size:", audioBuffer.byteLength);
          } else {
            console.error("[PATH B] ElevenLabs TTS failed:", ttsResp.status);
          }
        }
      } catch (ttsErr) {
        console.error("[PATH B] TTS error:", ttsErr);
      }
    }

    return new Response(
      JSON.stringify({ text, audio_base64, audio_format, _voice_path: "lovable+elevenlabs", _fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, { functionName: "personaplex-voice", authMode: "required", requireCompany: false, rawResponse: true })
);
