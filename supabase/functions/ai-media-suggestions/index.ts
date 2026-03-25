import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { type, keywords, brand_context } = body;

    if (!type || !["video", "image"].includes(type)) {
      throw new Error("type must be 'video' or 'image'");
    }

    const keywordList = (keywords || [])
      .slice(0, 10)
      .map((k: any) => `"${k.keyword}" (volume: ${k.impressions_28d || 0}, intent: ${k.intent || "unknown"})`)
      .join("\n- ");

    const brandInfo = brand_context
      ? `Company: ${brand_context.business_name || "N/A"}\nIndustry context: ${brand_context.description || "N/A"}\nValue proposition: ${brand_context.value_prop || "N/A"}`
      : "No brand context available.";

    const mediaGuidance = type === "video"
      ? "Each prompt should describe a cinematic video scene (5-10 seconds) with camera movement, lighting, and mood. Focus on professional videography language."
      : "Each prompt should describe a high-quality image with composition, lighting style, color palette, and professional photography/design language.";

    const systemPrompt = `You are a creative director specializing in SEO-optimized visual content for industrial/construction businesses.

Generate exactly 4 creative ${type} prompts that naturally incorporate themes from the top SEO keywords below. The prompts should be visually descriptive and production-ready.

${mediaGuidance}

Rules:
- Each prompt must be 1-2 sentences, under 200 characters
- Naturally weave keyword themes into visual descriptions (don't just list keywords)
- Make prompts specific, cinematic, and professional
- Vary styles: aerial/drone, close-up/macro, timelapse, portrait/team shots
- Return ONLY a JSON array of 4 strings, no other text

Top SEO Keywords:
- ${keywordList || "No keywords available — use general construction/industrial themes"}

Brand Context:
${brandInfo}`;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      agentName: "social",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate 4 ${type} prompt suggestions.` },
      ],
      maxTokens: 1000,
      temperature: 0.8,
    });

    let suggestions: string[] = [];
    try {
      const cleaned = result.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) suggestions = [];
      suggestions = suggestions.slice(0, 4).map((s) => String(s).trim()).filter(Boolean);
    } catch {
      console.error("Failed to parse AI suggestions:", result.content);
    }

    return { suggestions };
  }, { functionName: "ai-media-suggestions", requireCompany: false, wrapResult: false })
);
