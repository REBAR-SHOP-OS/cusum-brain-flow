import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * vizzy-tts — Proxies text to the Phase 7 TTS server and returns audio blob.
 *
 * POST { text } → audio/mpeg blob
 *
 * Uses TTS_API_URL secret (e.g. http://100.86.84.110:9009)
 */

Deno.serve((req) =>
  handleRequest(req, async ({ body, log }) => {
    const { text } = body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ttsUrl = Deno.env.get("TTS_API_URL");
    if (!ttsUrl) {
      log.error("TTS_API_URL secret not configured");
      return new Response(
        JSON.stringify({ error: "TTS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endpoint = `${ttsUrl}/v1/tts`;
    log.info("Generating TTS", { textLength: text.length, endpoint });

    const ttsResp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!ttsResp.ok) {
      const errText = await ttsResp.text().catch(() => "");
      log.error("TTS API error", { status: ttsResp.status, errText });
      return new Response(
        JSON.stringify({ error: `TTS error: ${ttsResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Stream the audio blob back to the client
    const audioBlob = await ttsResp.arrayBuffer();
    const contentType = ttsResp.headers.get("Content-Type") || "audio/mpeg";

    return new Response(audioBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  }, {
    functionName: "vizzy-tts",
    authMode: "required",
    requireCompany: false,
    rawResponse: true,
  })
);
