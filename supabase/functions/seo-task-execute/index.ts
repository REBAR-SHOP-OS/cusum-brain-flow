import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WPClient } from "../_shared/wpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ACTIONS = [
  "wp_update_meta",
  "wp_update_content",
  "wp_update_title",
  "wp_add_internal_link",
];

async function analyzeTask(task: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are an SEO task execution planner for a WordPress/WooCommerce site (rebar.shop).
Analyze the given SEO task and determine if it can be auto-executed via WordPress REST API.

Tasks you CAN auto-execute:
- Updating meta titles/descriptions on pages/posts
- Updating page/post content (HTML)
- Updating page/post titles
- Adding internal links to page content

Tasks you CANNOT auto-execute (need human):
- Google Search Console verification
- DNS changes, domain settings
- Google Analytics configuration
- Billing, payments, user management
- Product deletion or bulk operations
- Any action requiring third-party dashboard access

When proposing actions, use the entity_url from the task to identify which WordPress page/post to modify.
For wp_update_meta, the WordPress REST API uses Yoast SEO fields or similar — use "meta_description" or "meta_title" as field names.`;

  const userPrompt = `Task details:
- Title: ${task.title}
- Description: ${task.description || "N/A"}
- Type: ${task.task_type || "N/A"}
- Priority: ${task.priority}
- Entity URL: ${task.entity_url || "N/A"}
- AI Reasoning: ${task.ai_reasoning || "N/A"}
- Expected Impact: ${task.expected_impact || "N/A"}

Analyze this task and determine if it can be auto-executed.`;

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_execution_plan",
              description:
                "Propose whether the task can be auto-executed and the plan.",
              parameters: {
                type: "object",
                properties: {
                  can_execute: {
                    type: "boolean",
                    description: "Whether this task can be auto-executed",
                  },
                  plan_summary: {
                    type: "string",
                    description:
                      "Brief summary of what will be done (if can_execute=true) or why it cannot be automated",
                  },
                  actions: {
                    type: "array",
                    description:
                      "List of actions to execute (only if can_execute=true)",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ALLOWED_ACTIONS,
                        },
                        target: {
                          type: "string",
                          description: "Target page/post URL path",
                        },
                        field: {
                          type: "string",
                          description:
                            "Field to update (e.g. meta_description, meta_title, content)",
                        },
                        value: {
                          type: "string",
                          description: "New value to set",
                        },
                      },
                      required: ["type", "target"],
                      additionalProperties: false,
                    },
                  },
                  human_steps: {
                    type: "string",
                    description:
                      "Step-by-step instructions for human (only if can_execute=false)",
                  },
                },
                required: ["can_execute", "plan_summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "propose_execution_plan" },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    if (response.status === 429)
      throw new Error("Rate limited — please try again later.");
    if (response.status === 402)
      throw new Error("AI credits exhausted — please add funds.");
    throw new Error("AI analysis failed");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("AI did not return a structured plan");

  return JSON.parse(toolCall.function.arguments);
}

async function executeActions(
  actions: any[],
  wp: WPClient
): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    if (!ALLOWED_ACTIONS.includes(action.type)) {
      results.push(`SKIPPED: Unknown action type "${action.type}"`);
      continue;
    }

    try {
      // Resolve WordPress post/page ID from the target URL
      const targetPath = action.target?.replace(/^https?:\/\/[^/]+/, "") || "";
      let wpEntity: any = null;
      let entityType = "pages";

      // Try pages first, then posts
      try {
        const pages = await wp.get("/pages", { slug: targetPath.replace(/\//g, "") });
        if (Array.isArray(pages) && pages.length > 0) {
          wpEntity = pages[0];
          entityType = "pages";
        }
      } catch { /* ignore */ }

      if (!wpEntity) {
        try {
          const posts = await wp.get("/posts", { slug: targetPath.replace(/\//g, "") });
          if (Array.isArray(posts) && posts.length > 0) {
            wpEntity = posts[0];
            entityType = "posts";
          }
        } catch { /* ignore */ }
      }

      if (!wpEntity) {
        // Try searching by path in all pages
        try {
          const allPages = await wp.get("/pages", { per_page: "100" });
          if (Array.isArray(allPages)) {
            wpEntity = allPages.find(
              (p: any) =>
                p.link?.includes(targetPath) ||
                p.slug === targetPath.replace(/\//g, "")
            );
            if (wpEntity) entityType = "pages";
          }
        } catch { /* ignore */ }
      }

      if (!wpEntity) {
        results.push(
          `FAILED: Could not find WordPress entity for "${action.target}"`
        );
        continue;
      }

      const id = String(wpEntity.id);

      switch (action.type) {
        case "wp_update_meta": {
          // Use Yoast SEO meta fields
          const metaField =
            action.field === "meta_description"
              ? "yoast_wpseo_metadesc"
              : action.field === "meta_title"
              ? "yoast_wpseo_title"
              : action.field;
          const updateData: Record<string, unknown> = {
            meta: { [metaField]: action.value },
          };
          if (entityType === "pages") {
            await wp.updatePage(id, updateData);
          } else {
            await wp.updatePost(id, updateData);
          }
          results.push(
            `Updated ${action.field} on ${action.target}: "${(action.value || "").substring(0, 80)}..."`
          );
          break;
        }
        case "wp_update_title": {
          const updateData = { title: action.value };
          if (entityType === "pages") {
            await wp.updatePage(id, updateData);
          } else {
            await wp.updatePost(id, updateData);
          }
          results.push(`Updated title on ${action.target}`);
          break;
        }
        case "wp_update_content": {
          const updateData = { content: action.value };
          if (entityType === "pages") {
            await wp.updatePage(id, updateData);
          } else {
            await wp.updatePost(id, updateData);
          }
          results.push(`Updated content on ${action.target}`);
          break;
        }
        case "wp_add_internal_link": {
          // Append the link to existing content
          const currentContent =
            wpEntity.content?.rendered || wpEntity.content?.raw || "";
          const linkHtml = `<p><a href="${action.target}">${action.value || action.target}</a></p>`;
          const newContent = currentContent + linkHtml;
          if (entityType === "pages") {
            await wp.updatePage(id, { content: newContent });
          } else {
            await wp.updatePost(id, { content: newContent });
          }
          results.push(`Added internal link on ${action.target}`);
          break;
        }
      }
    } catch (err) {
      results.push(
        `ERROR on ${action.type} for ${action.target}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task_id, phase } = await req.json();
    if (!task_id || !phase) {
      return new Response(
        JSON.stringify({ error: "task_id and phase required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch task
    const { data: task, error: taskErr } = await sb
      .from("seo_tasks")
      .select("*")
      .eq("id", task_id)
      .single();

    if (taskErr || !task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["open", "in_progress"].includes(task.status)) {
      return new Response(
        JSON.stringify({ error: `Task status "${task.status}" cannot be executed` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase: analyze
    if (phase === "analyze") {
      const plan = await analyzeTask(task);
      return new Response(JSON.stringify(plan), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase: execute
    if (phase === "execute") {
      // Re-analyze to get fresh plan (never trust client)
      const plan = await analyzeTask(task);

      if (!plan.can_execute || !plan.actions?.length) {
        return new Response(
          JSON.stringify({ error: "Task cannot be auto-executed", human_steps: plan.human_steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate all action types
      for (const action of plan.actions) {
        if (!ALLOWED_ACTIONS.includes(action.type)) {
          return new Response(
            JSON.stringify({ error: `Blocked action type: ${action.type}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Execute via WordPress
      const wp = new WPClient();
      const results = await executeActions(plan.actions, wp);

      // Update task
      const executionLog = {
        plan_summary: plan.plan_summary,
        actions: plan.actions,
        results,
        timestamp: new Date().toISOString(),
      };

      await sb
        .from("seo_tasks")
        .update({
          status: "done",
          execution_log: executionLog,
          executed_at: new Date().toISOString(),
          executed_by: "ai",
        })
        .eq("id", task_id);

      return new Response(
        JSON.stringify({ success: true, results, task_status: "done" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid phase. Use "analyze" or "execute"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-task-execute error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
