import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * Vizzy One API Proxy
 *
 * Single backend source of truth: https://pc.tail669f65.ts.net
 *
 * Voice requests → POST /api/v1/vizzy/voice
 * Text requests  → POST /api/v1/vizzy/chat
 *
 * Response shape:
 *   { ok, reply, intent, grounded, audio_base64, audio_format, voice_path }
 *
 * Security: authMode "required" — all callers must be authenticated.
 * Behavior: strictly read-only — never simulates or claims ERP actions.
 */

const VIZZY_ONE_BASE = Deno.env.get("BACKEND_URL") || "https://pc.tail669f65.ts.net";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { messages, systemPrompt, voiceEnabled = true } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract latest user message text
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const text = lastUserMsg?.content || "";

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "No user message found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build conversation history string for context
    const conversationHistory = messages
      .filter((m: any) => m.content && !m.content.startsWith("[TOOL_") && !m.hidden)
      .slice(-12)
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");

    // Build enriched text with full context
    const enrichedText = systemPrompt
      ? `SYSTEM:\n${systemPrompt}\n\nCONVERSATION:\n${conversationHistory}\n\nUSER:\n${text}`
      : text;

    // Choose endpoint based on voiceEnabled
    const endpoint = voiceEnabled
      ? `${VIZZY_ONE_BASE}/api/v1/vizzy/voice`
      : `${VIZZY_ONE_BASE}/api/v1/vizzy/chat`;

    const requestBody = voiceEnabled
      ? { text: enrichedText, source: "lovable", voice_enabled: true, systemPrompt, messages }
      : { text: enrichedText, source: "lovable", systemPrompt, messages };

    console.log(`[personaplex-voice] Routing to Vizzy One API: ${endpoint} (context: ${systemPrompt ? "full" : "none"}, messages: ${messages.length})`);
    console.log("[personaplex-voice]", {
      hasSystemPrompt: !!systemPrompt,
      messageCount: messages.length,
      textLength: text.length,
    });

    try {
      const apiResp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text().catch(() => "");
        console.error("[personaplex-voice] Vizzy One API error:", apiResp.status, errText);
        return new Response(
          JSON.stringify({
            error: `Vizzy One API error: ${apiResp.status}`,
            _api_connected: false,
          }),
          { status: apiResp.status >= 500 ? 502 : apiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await apiResp.json();

      // Normalize response to match client expectations
      const hasAudio = Boolean(data.audio_base64);
      return new Response(
        JSON.stringify({
          text: data.reply || "",
          audio_base64: data.audio_base64 || null,
          audio_format: data.audio_format || null,
          _voice_path: data.voice_path || (hasAudio ? "vizzy-one-audio" : "vizzy-one-text"),
          _audio_status: hasAudio ? "vizzy-one" : "text-only",
          _api_connected: data.ok === true,
          _intent: data.intent || null,
          _grounded: data.grounded ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err) {
      console.error("[personaplex-voice] Vizzy One API connection failed:", err);
      return new Response(
        JSON.stringify({
          error: "Failed to connect to Vizzy One API",
          _api_connected: false,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }, { functionName: "personaplex-voice", authMode: "required", requireCompany: false, rawResponse: true })
);
