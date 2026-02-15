import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const { domain_id, messages } = await req.json();

    if (!domain_id || !messages?.length) {
      return new Response(JSON.stringify({ error: "domain_id and messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get domain
    const { data: domain } = await supabase
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .single();
    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch context data for the AI
    const [keywordsRes, pagesRes, insightsRes, tasksRes] = await Promise.all([
      supabase
        .from("seo_keyword_ai")
        .select("keyword, intent, impressions_28d, clicks_28d, ctr, avg_position, trend_score, opportunity_score, status, topic_cluster")
        .eq("domain_id", domain_id)
        .order("opportunity_score", { ascending: false })
        .limit(50),
      supabase
        .from("seo_page_ai")
        .select("url, impressions, clicks, ctr, avg_position, sessions, engagement_rate, conversions, revenue, seo_score, cwv_status")
        .eq("domain_id", domain_id)
        .order("seo_score", { ascending: false })
        .limit(30),
      supabase
        .from("seo_insight")
        .select("entity_type, insight_type, explanation_text, confidence_score")
        .eq("domain_id", domain_id)
        .order("confidence_score", { ascending: false })
        .limit(20),
      supabase
        .from("seo_tasks")
        .select("title, priority, status, task_type, expected_impact, created_by")
        .eq("domain_id", domain_id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const contextData = `
DOMAIN: ${domain.domain}

TOP KEYWORDS (by opportunity score):
${JSON.stringify(keywordsRes.data || [], null, 1)}

TOP PAGES (by SEO score):
${JSON.stringify(pagesRes.data || [], null, 1)}

LATEST AI INSIGHTS:
${JSON.stringify(insightsRes.data || [], null, 1)}

OPEN TASKS:
${JSON.stringify(tasksRes.data || [], null, 1)}
`;

    const systemPrompt = `You are the SEO Copilot for the Rebar ERP system, analyzing ${domain.domain}.

You ONLY answer based on the SEO data provided below. Never fabricate metrics.
Reference specific numbers, keywords, pages, and trends in your answers.
Be concise and action-oriented. Use markdown formatting.

If asked about something not in the data, say "I don't have that data yet — run an AI analysis first."

CURRENT SEO DATA:
${contextData}`;

    // Stream from Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI copilot error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("seo-ai-copilot error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
