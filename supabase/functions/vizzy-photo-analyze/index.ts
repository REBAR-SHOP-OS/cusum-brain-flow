import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { imageUrl, prompt } = ctx.body;
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

    const systemPrompt = `You are Vizzy, the CEO's AI assistant for a rebar fabrication shop (CUSUM/rebar.shop).
Analyze this photo from the shop floor. Identify:
- Any machine errors, damage, or safety issues
- Rebar tags, labels, or markings visible
- Production quality issues (bent angles, cut lengths, surface defects)
- Any equipment status indicators
Be specific and actionable. If you see a problem, suggest what to do.
If the user included a specific question, answer it directly.`;

    const userPrompt = prompt || "What do you see in this photo? Any issues or things I should know about?";

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    return { analysis: result.content || "Could not analyze image." };
  }, { functionName: "vizzy-photo-analyze", requireCompany: false, wrapResult: false })
);
