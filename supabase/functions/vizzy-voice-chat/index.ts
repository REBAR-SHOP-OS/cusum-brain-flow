import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * Vizzy Voice Chat — text-only path via Vizzy One API
 *
 * POST /api/v1/vizzy/chat → { ok, reply, intent, grounded }
 */

const VIZZY_ONE_BASE = "https://pc.tail669f65.ts.net";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { messages, systemPrompt } = body;
    if (!messages || !Array.isArray(messages)) throw new Error("messages array is required");

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const text = lastUserMsg?.content || "";

    if (!text.trim()) throw new Error("No user message found");

    console.log("[vizzy-voice-chat] Routing to Vizzy One API /api/v1/vizzy/chat");

    const apiResp = await fetch(`${VIZZY_ONE_BASE}/api/v1/vizzy/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source: "lovable" }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text().catch(() => "");
      console.error("[vizzy-voice-chat] Vizzy One API error:", apiResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Vizzy One API error: ${apiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await apiResp.json();

    return new Response(
      JSON.stringify({
        text: data.reply || "",
        _api_connected: data.ok === true,
        _intent: data.intent || null,
        _grounded: data.grounded ?? null,
        _voice_path: data.voice_path || "text-only",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, { functionName: "vizzy-voice-chat", authMode: "required", requireCompany: false, rawResponse: true })
);
