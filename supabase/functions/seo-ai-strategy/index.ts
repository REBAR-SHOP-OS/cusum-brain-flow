import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase, body }) => {
    const { domain_id } = body;

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

    const [keywordsRes, pagesRes, existingTasksRes] = await Promise.all([
      supabase
        .from("seo_keyword_ai")
        .select("*")
        .eq("domain_id", domain_id)
        .order("opportunity_score", { ascending: false })
        .limit(5000),
      supabase
        .from("seo_page_ai")
        .select("*")
        .eq("domain_id", domain_id)
        .order("seo_score", { ascending: true })
        .limit(5000),
      supabase
        .from("seo_tasks")
        .select("title, status")
        .eq("domain_id", domain_id)
        .in("status", ["open", "in_progress"]),
    ]);

    const keywords = keywordsRes.data || [];
    const pages = pagesRes.data || [];
    const existingTasks = existingTasksRes.data || [];

    const nearTop3 = keywords.filter((k: any) => k.avg_position && k.avg_position <= 5 && k.avg_position > 3);
    const risingImpressions = keywords.filter((k: any) => k.trend_score && k.trend_score > 20);
    const lowScorePages = pages.filter((p: any) => p.seo_score && p.seo_score < 50);
    const highImpLowCtr = keywords.filter((k: any) => k.impressions_28d > 100 && k.ctr < 0.02);

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-pro",
      agentName: "seo",
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
      toolChoice: { type: "function", function: { name: "weekly_strategy_tasks" } },
    });

    const toolCall = result.toolCalls?.[0];
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

    return { success: true, tasks_created: tasksCreated };
  }, { functionName: "seo-ai-strategy", requireCompany: false, wrapResult: false })
);
