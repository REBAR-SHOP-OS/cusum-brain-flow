import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { messages, mode } = body;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt =
      mode === "translate"
        ? "Strict translator. Persian→English, English→Persian. Output ONLY the translation. No explanations."
        : "You are Nila, a helpful and concise voice assistant. Always reply in the same language the user speaks. If the user speaks Persian, reply in Persian. If English, reply in English. Keep answers short (2-3 sentences max). Be friendly and direct.";

    const maxTokens = mode === "translate" ? 100 : 300;
    const temperature = mode === "translate" ? 0 : 0.2;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []).slice(-4),
        ],
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) throw new Error("Rate limit exceeded. Please try again later.");
      if (status === 402) throw new Error("Payment required. Please add credits.");
      const t = await response.text();
      console.error("Gemini API error:", status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }, { functionName: "nila-chat", authMode: "required", requireCompany: false, rawResponse: true })
);
