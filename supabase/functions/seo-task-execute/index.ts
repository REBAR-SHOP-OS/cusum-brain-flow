import { handleRequest } from "../_shared/requestHandler.ts";
import { WPClient } from "../_shared/wpClient.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

const ALLOWED_ACTIONS = [
  "wp_update_meta",
  "wp_update_content",
  "wp_update_title",
  "wp_add_internal_link",
  "wp_inject_jsonld",
  "wp_update_product_meta",
  "wp_update_product_content",
  "wp_create_post",
  "wp_update_slug",
];

// ─── AI-powered content generation ───
async function generateContent(task: any, action: any, currentContent: string): Promise<string> {
  const result = await callAI({
    provider: "gemini",
    model: "gemini-3-flash-preview",
    agentName: "seo",
    messages: [
      {
        role: "system",
        content: `You are an SEO content specialist for rebar.shop, a rebar fabrication and supply company in Toronto/GTA. 
Generate the exact content requested. Return ONLY the content, no explanations or markdown wrappers.
If generating HTML, return valid HTML only. If generating JSON-LD, return a complete <script type="application/ld+json">...</script> tag.`,
      },
      {
        role: "user",
        content: `Task: ${task.title}
Description: ${task.description || "N/A"}
Action type: ${action.type}
Field: ${action.field || "N/A"}
Target: ${action.target || "N/A"}
Current content (first 3000 chars): ${currentContent.slice(0, 3000)}

Generate the appropriate content for this SEO fix. Be specific to the rebar/construction industry.`,
      },
    ],
  });

  return result.text?.trim() || "";
}

async function analyzeTask(task: any, wp: WPClient | null): Promise<any> {
  // Fetch current content context if we have a URL and WP client
  let currentContentContext = "";
  if (wp && task.entity_url) {
    try {
      const targetPath = task.entity_url.replace(/^https?:\/\/[^/]+/, "").replace(/\//g, "") || "";
      // Try pages
      let entity: any = null;
      try {
        const pages = await wp.get("/pages", { slug: targetPath });
        if (Array.isArray(pages) && pages.length > 0) entity = pages[0];
      } catch { /* */ }
      if (!entity) {
        try {
          const posts = await wp.get("/posts", { slug: targetPath });
          if (Array.isArray(posts) && posts.length > 0) entity = posts[0];
        } catch { /* */ }
      }
      if (!entity) {
        // Try products by slug
        try {
          const products = await wp.listProducts({ slug: targetPath });
          if (Array.isArray(products) && products.length > 0) {
            entity = products[0];
            currentContentContext += `\n[ENTITY TYPE: product, ID: ${entity.id}]`;
          }
        } catch { /* */ }
      }
      if (entity) {
        currentContentContext += `\nCurrent title: ${entity.title?.rendered || entity.name || ""}`;
        currentContentContext += `\nCurrent slug: ${entity.slug || ""}`;
        currentContentContext += `\nCurrent meta: ${JSON.stringify(entity.yoast_head_json || entity.meta || {}).slice(0, 500)}`;
        currentContentContext += `\nContent preview: ${(entity.content?.rendered || entity.description || "").slice(0, 1000)}`;
      }
    } catch (e) {
      console.warn("Could not fetch entity context:", e);
    }
  }

  const systemPrompt = `You are an SEO task execution planner for rebar.shop (WordPress + WooCommerce).
You have FULL read/write access to WordPress via REST API. Be AGGRESSIVE about auto-executing tasks.

Tasks you CAN auto-execute (can_execute=true):
- Updating meta titles/descriptions (Yoast SEO fields) → wp_update_meta
- Updating page/post content (HTML) → wp_update_content
- Updating page/post titles → wp_update_title
- Adding internal links to existing content → wp_add_internal_link
- Injecting JSON-LD schema markup into page content → wp_inject_jsonld
- Updating product descriptions/short descriptions → wp_update_product_content
- Updating product SEO meta (Yoast fields on products) → wp_update_product_meta
- Creating new blog posts/content pages → wp_create_post
- Updating slugs/URLs → wp_update_slug
- Schema.org markup (inject via content or meta) → wp_inject_jsonld
- Title optimization with keywords → wp_update_title + wp_update_meta
- Content expansion/optimization → wp_update_content
- Product page SEO improvements → wp_update_product_meta + wp_update_product_content

Tasks you CANNOT auto-execute (need human):
- Google Search Console verification
- DNS/domain changes
- Google Analytics setup
- Plugin installation/configuration (but you CAN work with existing Yoast fields)
- Server-side redirects (.htaccess)
- Image alt text on media library (but CAN update in post content HTML)

IMPORTANT: For schema markup tasks, use wp_inject_jsonld — this appends a <script type="application/ld+json"> block to the page content. You do NOT need theme access for this.
For product schema, also use wp_update_product_meta to ensure Yoast/structured data fields are populated.
For title optimization, include specific keyword-optimized titles as the value.

When the value field needs dynamic content generation, set value to "[GENERATE]" and the system will auto-generate it.`;

  const userPrompt = `Task details:
- Title: ${task.title}
- Description: ${task.description || "N/A"}
- Type: ${task.task_type || "N/A"}
- Priority: ${task.priority}
- Entity URL: ${task.entity_url || "N/A"}
- AI Reasoning: ${task.ai_reasoning || "N/A"}
- Expected Impact: ${task.expected_impact || "N/A"}
${currentContentContext ? `\n--- Current WordPress Content ---${currentContentContext}` : ""}

Analyze and create an execution plan. Be aggressive — most SEO tasks CAN be auto-executed via the WordPress API.`;

  const aiResult = await callAI({
    provider: "gemini",
    model: "gemini-3-flash-preview",
    agentName: "seo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "propose_execution_plan",
          description: "Propose whether the task can be auto-executed and the plan.",
          parameters: {
            type: "object",
            properties: {
              can_execute: {
                type: "boolean",
                description: "Whether this task can be auto-executed. Should be true for most SEO tasks.",
              },
              plan_summary: {
                type: "string",
                description: "Brief summary of what will be done",
              },
              actions: {
                type: "array",
                description: "List of actions to execute (only if can_execute=true)",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ALLOWED_ACTIONS },
                    target: { type: "string", description: "Target page/post/product URL path or slug" },
                    field: { type: "string", description: "Field to update (e.g. meta_description, meta_title, short_description)" },
                    value: { type: "string", description: "New value to set. Use [GENERATE] for AI-generated content." },
                  },
                  required: ["type", "target"],
                  additionalProperties: false,
                },
              },
              human_steps: {
                type: "string",
                description: "Step-by-step instructions for human (only if can_execute=false)",
              },
            },
            required: ["can_execute", "plan_summary"],
            additionalProperties: false,
          },
        },
      },
    ],
    toolChoice: { type: "function", function: { name: "propose_execution_plan" } },
  });

  const toolCall = aiResult.toolCalls?.[0];
  if (!toolCall) throw new Error("AI did not return a structured plan");

  return JSON.parse(toolCall.function.arguments);
}

// ─── Entity resolution ───
async function resolveEntity(wp: WPClient, target: string): Promise<{ entity: any; type: "pages" | "posts" | "products" } | null> {
  const slug = target.replace(/^https?:\/\/[^/]+/, "").replace(/\//g, "") || target;

  // Try pages
  try {
    const pages = await wp.get("/pages", { slug });
    if (Array.isArray(pages) && pages.length > 0) return { entity: pages[0], type: "pages" };
  } catch { /* */ }

  // Try posts
  try {
    const posts = await wp.get("/posts", { slug });
    if (Array.isArray(posts) && posts.length > 0) return { entity: posts[0], type: "posts" };
  } catch { /* */ }

  // Try products
  try {
    const products = await wp.listProducts({ slug });
    if (Array.isArray(products) && products.length > 0) return { entity: products[0], type: "products" };
  } catch { /* */ }

  // Broader search in pages
  try {
    const allPages = await wp.get("/pages", { per_page: "100" });
    if (Array.isArray(allPages)) {
      const match = allPages.find((p: any) => p.link?.includes(slug) || p.slug === slug);
      if (match) return { entity: match, type: "pages" };
    }
  } catch { /* */ }

  // Broader search in products by category name
  try {
    const allProducts = await wp.listProducts({ per_page: "100", search: slug });
    if (Array.isArray(allProducts) && allProducts.length > 0) return { entity: allProducts[0], type: "products" };
  } catch { /* */ }

  return null;
}

async function executeActions(actions: any[], wp: WPClient, task: any): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    if (!ALLOWED_ACTIONS.includes(action.type)) {
      results.push(`SKIPPED: Unknown action type "${action.type}"`);
      continue;
    }

    try {
      const resolved = await resolveEntity(wp, action.target || "");

      // For wp_create_post, we don't need an existing entity
      if (action.type === "wp_create_post") {
        let content = action.value || "";
        if (content === "[GENERATE]" || !content) {
          content = await generateContent(task, action, "");
        }
        const postData: Record<string, unknown> = {
          title: action.field || task.title,
          content,
          status: "draft",
        };
        const result = await wp.createPost(postData);
        results.push(`Created draft post: "${result.title?.rendered}" (ID: ${result.id})`);
        continue;
      }

      if (!resolved) {
        // For bulk tasks (e.g. "all cage products"), try to find multiple products
        if (action.type.startsWith("wp_update_product") || action.type === "wp_inject_jsonld") {
          const searchTerm = action.target?.replace(/[/-]/g, " ") || "";
          try {
            const products = await wp.listProducts({ per_page: "50", search: searchTerm });
            if (Array.isArray(products) && products.length > 0) {
              let count = 0;
              for (const product of products) {
                try {
                  await executeSingleAction(action, { entity: product, type: "products" }, wp, task);
                  count++;
                } catch (e) {
                  results.push(`ERROR on product ${product.id}: ${e instanceof Error ? e.message : String(e)}`);
                }
              }
              results.push(`Applied ${action.type} to ${count}/${products.length} products matching "${searchTerm}"`);
              continue;
            }
          } catch { /* */ }
        }
        results.push(`FAILED: Could not find WordPress entity for "${action.target}"`);
        continue;
      }

      const msg = await executeSingleAction(action, resolved, wp, task);
      results.push(msg);
    } catch (err) {
      results.push(`ERROR on ${action.type} for ${action.target}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return results;
}

async function executeSingleAction(
  action: any,
  resolved: { entity: any; type: "pages" | "posts" | "products" },
  wp: WPClient,
  task: any
): Promise<string> {
  const { entity, type } = resolved;
  const id = String(entity.id);
  const currentContent = entity.content?.rendered || entity.description || "";

  // Auto-generate value if marked as [GENERATE]
  let value = action.value || "";
  if (value === "[GENERATE]" || (!value && action.type !== "wp_add_internal_link")) {
    value = await generateContent(task, action, currentContent);
  }

  switch (action.type) {
    case "wp_update_meta": {
      const metaField = action.field === "meta_description" ? "yoast_wpseo_metadesc"
        : action.field === "meta_title" ? "yoast_wpseo_title"
        : action.field;
      const updateData: Record<string, unknown> = { meta: { [metaField]: value } };
      if (type === "products") {
        await wp.updateProduct(id, { meta_data: [{ key: `_${metaField}`, value }] });
      } else if (type === "pages") {
        await wp.updatePage(id, updateData);
      } else {
        await wp.updatePost(id, updateData);
      }
      return `Updated ${action.field} on ${action.target}: "${value.substring(0, 80)}..."`;
    }

    case "wp_update_title": {
      if (type === "products") {
        await wp.updateProduct(id, { name: value });
      } else if (type === "pages") {
        await wp.updatePage(id, { title: value });
      } else {
        await wp.updatePost(id, { title: value });
      }
      return `Updated title on ${action.target}: "${value.substring(0, 80)}"`;
    }

    case "wp_update_content": {
      if (type === "products") {
        await wp.updateProduct(id, { description: value });
      } else if (type === "pages") {
        await wp.updatePage(id, { content: value });
      } else {
        await wp.updatePost(id, { content: value });
      }
      return `Updated content on ${action.target}`;
    }

    case "wp_update_slug": {
      if (type === "products") {
        await wp.updateProduct(id, { slug: value });
      } else if (type === "pages") {
        await wp.updatePage(id, { slug: value });
      } else {
        await wp.updatePost(id, { slug: value });
      }
      return `Updated slug on ${action.target} to "${value}"`;
    }

    case "wp_add_internal_link": {
      const linkHtml = `<p><a href="${action.target}">${value || action.target}</a></p>`;
      const newContent = currentContent + linkHtml;
      if (type === "products") {
        await wp.updateProduct(id, { description: newContent });
      } else if (type === "pages") {
        await wp.updatePage(id, { content: newContent });
      } else {
        await wp.updatePost(id, { content: newContent });
      }
      return `Added internal link on ${action.target}`;
    }

    case "wp_inject_jsonld": {
      // Generate JSON-LD schema and append to content
      let jsonLd = value;
      if (!jsonLd || jsonLd === "[GENERATE]") {
        jsonLd = await generateContent(task, { ...action, type: "wp_inject_jsonld" }, currentContent);
      }
      // Ensure it's wrapped in script tag
      if (!jsonLd.includes("<script")) {
        jsonLd = `<script type="application/ld+json">${jsonLd}</script>`;
      }
      // Remove existing JSON-LD to avoid duplicates
      const cleanedContent = currentContent.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
      const newContent = cleanedContent + "\n" + jsonLd;
      if (type === "products") {
        await wp.updateProduct(id, { description: newContent });
      } else if (type === "pages") {
        await wp.updatePage(id, { content: newContent });
      } else {
        await wp.updatePost(id, { content: newContent });
      }
      return `Injected JSON-LD schema on ${action.target} (${entity.slug || id})`;
    }

    case "wp_update_product_meta": {
      const metaKey = action.field === "meta_description" ? "_yoast_wpseo_metadesc"
        : action.field === "meta_title" ? "_yoast_wpseo_title"
        : action.field?.startsWith("_") ? action.field : `_${action.field}`;
      await wp.updateProduct(id, { meta_data: [{ key: metaKey, value }] });
      return `Updated product meta ${action.field} on ${entity.name || action.target}`;
    }

    case "wp_update_product_content": {
      const field = action.field === "short_description" ? "short_description" : "description";
      await wp.updateProduct(id, { [field]: value });
      return `Updated product ${field} on ${entity.name || action.target}`;
    }

    case "wp_create_post": {
      const result = await wp.createPost({ title: action.field || task.title, content: value, status: "draft" });
      return `Created draft post: "${result.title?.rendered}" (ID: ${result.id})`;
    }

    default:
      return `SKIPPED: Unhandled action type "${action.type}"`;
  }
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

    // Initialize WordPress client
    let wp: WPClient | null = null;
    try {
      wp = new WPClient();
    } catch (e) {
      console.warn("WP client init failed:", e);
    }

    // Phase: analyze
    if (phase === "analyze") {
      const plan = await analyzeTask(task, wp);
      return new Response(JSON.stringify(plan), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase: execute
    if (phase === "execute") {
      if (!wp) {
        return new Response(
          JSON.stringify({ error: "WordPress connection not available" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const plan = await analyzeTask(task, wp);

      if (!plan.can_execute || !plan.actions?.length) {
        return new Response(
          JSON.stringify({ error: "Task cannot be auto-executed", human_steps: plan.human_steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const action of plan.actions) {
        if (!ALLOWED_ACTIONS.includes(action.type)) {
          return new Response(
            JSON.stringify({ error: `Blocked action type: ${action.type}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const results = await executeActions(plan.actions, wp, task);

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
