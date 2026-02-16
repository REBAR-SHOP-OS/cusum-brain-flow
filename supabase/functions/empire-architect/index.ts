import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { venture } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a venture analysis AI. Return only valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("empire-architect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
