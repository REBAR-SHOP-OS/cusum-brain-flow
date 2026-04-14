import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

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

    const PERSONAPLEX_API_URL = Deno.env.get("PERSONAPLEX_API_URL");
    const PERSONAPLEX_API_KEY = Deno.env.get("PERSONAPLEX_API_KEY");

    console.log("[personaplex-voice] PERSONAPLEX_API_URL configured:", !!PERSONAPLEX_API_URL);
    console.log("[personaplex-voice] PERSONAPLEX_API_KEY configured:", !!PERSONAPLEX_API_KEY);

    // ── PersonaPlex path (when adapter is deployed) ──
    if (PERSONAPLEX_API_URL && PERSONAPLEX_API_KEY) {
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

    return new Response(
      JSON.stringify({ text, audio_base64: null, audio_format: null, _fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, { functionName: "personaplex-voice", authMode: "required", requireCompany: false, rawResponse: true })
);
