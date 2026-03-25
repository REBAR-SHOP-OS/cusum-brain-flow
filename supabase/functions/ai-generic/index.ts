import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { prompt, systemPrompt, model } = body;
    if (!prompt) throw new Error("prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt || "You are a helpful assistant. Be concise and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted. Please add funds.");
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { result: content };
  }, { functionName: "ai-generic", requireCompany: false, wrapResult: false })
);
