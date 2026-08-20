import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { venture } = body;

    const prompt = `You are a ruthless startup advisor. Analyze this venture idea and return ONLY valid JSON.

Venture: ${venture.name}
Vertical: ${venture.vertical || "Not specified"}
Phase: ${venture.phase}
Problem: ${venture.problem_statement || "Not defined"}
Target Customer: ${venture.target_customer || "Not defined"}
Value Multiplier: ${venture.value_multiplier || "Not defined"}
Competitive Notes: ${venture.competitive_notes || "None"}
MVP Scope: ${venture.mvp_scope || "Not defined"}
Distribution Plan: ${venture.distribution_plan || "Not defined"}
Revenue Model: ${venture.revenue_model || "Not defined"}
Status: ${venture.status}

Return JSON with these exact fields:
{
  "viability_score": <1-10>,
  "problem_clarity": "<1-2 sentence assessment>",
  "market_size": "<estimate with reasoning>",
  "risks": ["<risk1>", "<risk2>", "<risk3>"],
  "next_actions": ["<action1>", "<action2>", "<action3>"],
  "recommendation": "<continue|kill>"
}`;

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      agentName: "empire",
      messages: [
        { role: "system", content: "You are a venture analysis AI. Return only valid JSON, no markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = result.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const analysis = JSON.parse(jsonMatch[0]);
    return { analysis };
  }, { functionName: "empire-architect", requireCompany: false, wrapResult: false })
);
