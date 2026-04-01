import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { prompt, type, duration } = body;
    if (!prompt) throw new Error("prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = type === "voiceover"
      ? `You are an expert at writing voiceover scripts. The user gives you a rough idea and you return an enhanced, natural-sounding voiceover script in the same language as the input. Return ONLY the enhanced script text, nothing else.`
      : `You are an expert music director for video ads. The user gives you a rough music idea and you return an enhanced, detailed music generation prompt in English that will produce the best results with an AI music generator. Include genre, mood, tempo, instruments, and style details. Target duration: ${duration || 30} seconds. Return ONLY the enhanced prompt text, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
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
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim() || prompt;
    return { enhancedPrompt };
  }, { functionName: "enhance-music-prompt", authMode: "required", requireCompany: false, wrapResult: false })
);
