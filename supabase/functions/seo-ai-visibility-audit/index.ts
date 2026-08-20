import { handleRequest } from "../_shared/requestHandler.ts";

const AUDIT_TOOL = {
  type: "function" as const,
  function: {
    name: "ai_visibility_audit",
    description: "Return a structured AI visibility audit with 4 categories and checklist items.",
    parameters: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Category name: AI Platform Visibility, Content Gaps, Schema Markup, Action Items" },
              icon: { type: "string", enum: ["bot", "search", "code", "sparkles"] },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short actionable title" },
                    description: { type: "string", description: "Detailed recommendation" },
                    priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    is_task: { type: "boolean", description: "Whether this should be tracked as an SEO task" },
                    expected_impact: { type: "string", description: "Expected AI visibility impact if implemented" },
                  },
                  required: ["title", "description", "priority", "is_task"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name", "icon", "items"],
            additionalProperties: false,
          },
        },
      },
      required: ["categories"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are an AI Visibility specialist who helps brands optimize their presence in AI-powered search tools (ChatGPT, Google AI Mode/Overviews, Perplexity, Claude).

Perform a comprehensive AI Visibility audit for the given business. Return exactly 4 categories:
1. AI Platform Visibility - How likely the brand appears in ChatGPT, Google AI Overviews, Perplexity, and other AI tools. Assess each platform.
2. Content Gaps - Missing informational content, FAQs, guides, and resources that AI tools would reference.
3. Schema Markup - Organization, Product, Service, FAQPage, and other structured data recommendations.
4. Action Items - 5 specific, actionable steps to improve AI visibility.

For each category, provide 4-6 specific, actionable items. Mark high-priority actionable items as is_task: true.
Be specific to the industry and target market of the business.`;

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient, userId, companyId }) => {
    const { domain, description } = body;
    if (!domain) throw new Error("domain is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `Perform an AI Visibility audit for ${domain}${description ? ` (${description})` : ""}. Analyze how this brand appears across AI-powered search tools and provide specific, actionable recommendations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [AUDIT_TOOL],
        tool_choice: { type: "function", function: { name: "ai_visibility_audit" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured audit data");
    }

    const audit = JSON.parse(toolCall.function.arguments);

    // Auto-insert high-priority tasks into seo_tasks
    let tasksCreated = 0;
    if (companyId) {
      const { data: domainRow } = await serviceClient
        .from("seo_domains")
        .select("id")
        .eq("company_id", companyId)
        .limit(1)
        .single();

      const domainId = domainRow?.id || null;

      for (const category of audit.categories) {
        for (const item of category.items) {
          if (!item.is_task || (item.priority !== "high" && item.priority !== "critical")) continue;

          const { data: existing } = await serviceClient
            .from("seo_tasks")
            .select("id")
            .eq("company_id", companyId)
            .eq("title", item.title)
            .in("status", ["open", "in_progress"])
            .limit(1);

          if (existing && existing.length > 0) continue;

          await serviceClient.from("seo_tasks").insert({
            company_id: companyId,
            domain_id: domainId,
            title: item.title,
            description: item.description,
            priority: item.priority,
            task_type: "ai_visibility",
            created_by: "ai",
            ai_reasoning: `AI Visibility Audit — ${category.name}`,
            expected_impact: item.expected_impact || null,
            status: "open",
          });
          tasksCreated++;
        }
      }
    }

    return { audit, tasksCreated };
  }, { functionName: "seo-ai-visibility-audit", requireCompany: false, wrapResult: false })
);
