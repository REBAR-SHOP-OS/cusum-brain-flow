import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { venture } = await req.json();

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

    // GPT: strict JSON output
    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a venture analysis AI. Return only valid JSON, no markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = result.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("empire-architect error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
