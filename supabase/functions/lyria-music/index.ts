import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { prompt, duration } = body;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/lyria-3-clip-preview:generateContent";

    const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lyria 3 API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Music generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Find the audio part — it may not be the first part
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let audioBase64: string | null = null;
    let mimeType = "audio/mp3";

    for (const part of parts) {
      if (part?.inlineData?.data) {
        audioBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "audio/mp3";
        break;
      }
    }

    if (!audioBase64) {
      console.error("No audio data in Lyria response parts:", JSON.stringify(parts.map((p: any) => Object.keys(p))));
      return new Response(JSON.stringify({ error: "No audio generated" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 to binary
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes.buffer, {
      headers: { ...corsHeaders, "Content-Type": mimeType },
    });
  }, { functionName: "lyria-music", authMode: "none", requireCompany: false, rawResponse: true })
);
