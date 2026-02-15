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
    const { domain_id } = await req.json();

    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch all AI data
    const [keywordsRes, pagesRes, existingTasksRes] = await Promise.all([
      supabase
        .from("seo_keyword_ai")
        .select("*")
        .eq("domain_id", domain_id)
        .order("opportunity_score", { ascending: false })
        .limit(200),
      supabase
        .from("seo_page_ai")
        .select("*")
        .eq("domain_id", domain_id)
        .order("seo_score", { ascending: true })
        .limit(100),
      supabase
        .from("seo_tasks")
        .select("title, status")
        .eq("domain_id", domain_id)
        .in("status", ["open", "in_progress"]),
    ]);

    const keywords = keywordsRes.data || [];
    const pages = pagesRes.data || [];
    const existingTasks = existingTasksRes.data || [];

    // Find strategic opportunities
    const nearTop3 = keywords.filter((k: any) => k.avg_position && k.avg_position <= 5 && k.avg_position > 3);
    const risingImpressions = keywords.filter((k: any) => k.trend_score && k.trend_score > 20);
    const lowScorePages = pages.filter((p: any) => p.seo_score && p.seo_score < 50);
    const highImpLowCtr = keywords.filter((k: any) => k.impressions_28d > 100 && k.ctr < 0.02);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a strategic SEO advisor for ${domain.domain}. Create a weekly SEO roadmap with specific, actionable tasks. Each task must have clear expected impact. Do NOT create tasks that duplicate existing open tasks.`,
          },
          {
            role: "user",
            content: `Weekly strategy analysis for ${domain.domain}:

KEYWORDS NEAR TOP 3 (positions 3-5, push to #1-3):
${JSON.stringify(nearTop3.slice(0, 20), null, 1)}

RISING IMPRESSION KEYWORDS (trend > 20):
${JSON.stringify(risingImpressions.slice(0, 20), null, 1)}

HIGH IMPRESSIONS, LOW CTR (<2%):
${JSON.stringify(highImpLowCtr.slice(0, 20), null, 1)}

LOW SEO SCORE PAGES:
${JSON.stringify(lowScorePages.slice(0, 15), null, 1)}

EXISTING OPEN TASKS (do not duplicate):
${JSON.stringify(existingTasks, null, 1)}

Generate 5-10 high-impact strategic tasks.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "weekly_strategy_tasks",
              description: "Return weekly strategic SEO tasks",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        task_type: { type: "string", enum: ["content", "technical", "internal_link"] },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        expected_impact: { type: "string" },
                        entity_url: { type: "string" },
                        ai_reasoning: { type: "string" },
                      },
                      required: ["title", "description", "task_type", "priority", "expected_impact", "ai_reasoning"],
                    },
                  },
                },
                required: ["tasks"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "weekly_strategy_tasks" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI strategy error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
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
      return new Response(JSON.stringify({ error: "AI strategy failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no tasks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const strategy = JSON.parse(toolCall.function.arguments);
    let tasksCreated = 0;

    for (const task of strategy.tasks || []) {
      const { error } = await supabase.from("seo_tasks").insert({
        domain_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: "open",
        task_type: task.task_type,
        expected_impact: task.expected_impact,
        entity_url: task.entity_url || null,
        created_by: "ai",
        ai_reasoning: task.ai_reasoning,
        company_id: domain.company_id,
      });
      if (!error) tasksCreated++;
    }

    return new Response(
      JSON.stringify({ success: true, tasks_created: tasksCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-ai-strategy error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
