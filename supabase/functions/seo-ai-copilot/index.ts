import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAIStream, callAI, AIError } from "../_shared/aiRouter.ts";
import { WPClient } from "../_shared/wpClient.ts";
import { WPClient } from "../_shared/wpClient.ts";

// ─── WordPress Tool Definitions ───
const wpTools = [
  {
    type: "function" as const,
    function: {
      name: "wp_list_posts",
      description: "List WordPress posts from rebar.shop. Returns title, id, slug, status, excerpt.",
      parameters: {
        type: "object",
        properties: {
          per_page: { type: "string", description: "Number of posts (default 20, max 100)" },
          status: { type: "string", description: "Post status: publish, draft, pending, private" },
          search: { type: "string", description: "Search query to filter posts" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_list_pages",
      description: "List WordPress pages from rebar.shop.",
      parameters: {
        type: "object",
        properties: {
          per_page: { type: "string", description: "Number of pages (default 20)" },
          search: { type: "string", description: "Search query" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_get_post",
      description: "Get full details of a WordPress post by ID, including content, meta, SEO fields.",
      parameters: {
        type: "object",
        properties: { post_id: { type: "string", description: "Post ID" } },
        required: ["post_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_get_page",
      description: "Get full details of a WordPress page by ID.",
      parameters: {
        type: "object",
        properties: { page_id: { type: "string", description: "Page ID" } },
        required: ["page_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_update_post",
      description: "Update a WordPress post. Can change title, content, excerpt, status, slug, meta (including Yoast/RankMath SEO fields).",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "Post ID to update" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          excerpt: { type: "string", description: "New excerpt" },
          slug: { type: "string", description: "New URL slug" },
          status: { type: "string", description: "publish, draft, pending" },
          meta: { type: "object", description: "Meta fields to update (e.g. _yoast_wpseo_title, _yoast_wpseo_metadesc, rank_math_title, rank_math_description)" },
        },
        required: ["post_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_update_page",
      description: "Update a WordPress page. Can change title, content, excerpt, slug, status, meta.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "Page ID to update" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          excerpt: { type: "string", description: "New excerpt" },
          slug: { type: "string", description: "New URL slug" },
          status: { type: "string", description: "publish, draft, pending" },
          meta: { type: "object", description: "Meta fields to update" },
        },
        required: ["page_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_create_post",
      description: "Create a new WordPress post.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Post title" },
          content: { type: "string", description: "Post content (HTML)" },
          excerpt: { type: "string", description: "Post excerpt" },
          slug: { type: "string", description: "URL slug" },
          status: { type: "string", description: "publish or draft (default draft)" },
          meta: { type: "object", description: "Meta fields (SEO title, desc, etc.)" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "wp_list_products",
      description: "List WooCommerce products from rebar.shop.",
      parameters: {
        type: "object",
        properties: {
          per_page: { type: "string", description: "Number of products (default 20)" },
          search: { type: "string", description: "Search query" },
        },
        required: [],
      },
    },
  },
];

// ─── Tool execution ───
async function executeWpTool(wp: WPClient, name: string, args: Record<string, any>): Promise<string> {
  try {
    let result: any;
    switch (name) {
      case "wp_list_posts":
        result = await wp.listPosts(args);
        return JSON.stringify((result || []).map((p: any) => ({
          id: p.id, title: p.title?.rendered, slug: p.slug, status: p.status,
          link: p.link, excerpt: p.excerpt?.rendered?.slice(0, 200),
        })));
      case "wp_list_pages":
        result = await wp.listPages(args);
        return JSON.stringify((result || []).map((p: any) => ({
          id: p.id, title: p.title?.rendered, slug: p.slug, status: p.status, link: p.link,
        })));
      case "wp_get_post":
        result = await wp.getPost(args.post_id);
        return JSON.stringify({
          id: result.id, title: result.title?.rendered, slug: result.slug,
          status: result.status, link: result.link,
          content: result.content?.rendered?.slice(0, 5000),
          excerpt: result.excerpt?.rendered,
          meta: result.meta,
          yoast_head_json: result.yoast_head_json,
        });
      case "wp_get_page":
        result = await wp.getPage(args.page_id);
        return JSON.stringify({
          id: result.id, title: result.title?.rendered, slug: result.slug,
          status: result.status, link: result.link,
          content: result.content?.rendered?.slice(0, 5000),
          meta: result.meta,
          yoast_head_json: result.yoast_head_json,
        });
      case "wp_update_post": {
        const { post_id, ...data } = args;
        result = await wp.updatePost(post_id, data);
        return JSON.stringify({ success: true, id: result.id, title: result.title?.rendered, link: result.link });
      }
      case "wp_update_page": {
        const { page_id, ...data } = args;
        result = await wp.updatePage(page_id, data);
        return JSON.stringify({ success: true, id: result.id, title: result.title?.rendered, link: result.link });
      }
      case "wp_create_post":
        result = await wp.createPost(args);
        return JSON.stringify({ success: true, id: result.id, title: result.title?.rendered, link: result.link, status: result.status });
      case "wp_list_products":
        result = await wp.listProducts(args);
        return JSON.stringify((result || []).map((p: any) => ({
          id: p.id, name: p.name, slug: p.slug, status: p.status, price: p.price, link: p.permalink,
        })));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient, body }) => {
    const { domain_id, messages } = body;

    if (!domain_id || !messages?.length) {
      return new Response(JSON.stringify({ error: "domain_id and messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
      return json({ error: "domain_id and messages required" }, 400);
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.company_id) {
      return json({ error: "User profile not found" }, 403);
    }

    const { data: domain } = await serviceClient
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .eq("company_id", profile.company_id)
      .single();

    if (!domain) {
      return json({ error: "Domain not found or access denied" }, 404);
    }

    // Fetch SEO context data
    const [keywordsRes, pagesRes, insightsRes, tasksRes] = await Promise.all([
      serviceClient
        .from("seo_keyword_ai")
        .select("keyword, intent, impressions_28d, clicks_28d, ctr, avg_position, trend_score, opportunity_score, status, topic_cluster")
        .eq("domain_id", domain_id)
        .order("opportunity_score", { ascending: false })
        .limit(50),
      serviceClient
        .from("seo_page_ai")
        .select("url, impressions, clicks, ctr, avg_position, sessions, engagement_rate, conversions, revenue, seo_score, cwv_status")
        .eq("domain_id", domain_id)
        .order("seo_score", { ascending: false })
        .limit(30),
      serviceClient
        .from("seo_insight")
        .select("entity_type, insight_type, explanation_text, confidence_score")
        .eq("domain_id", domain_id)
        .order("confidence_score", { ascending: false })
        .limit(20),
      serviceClient
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

    const systemPrompt = `You are the SEO Copilot for rebar.shop (WordPress + WooCommerce).

You have TWO capabilities:
1. **SEO Data Analysis** — answer questions based on the SEO data below
2. **WordPress Read/Write** — you can directly read AND edit the website using WordPress API tools

## WordPress Tools Available:
- **wp_list_posts / wp_list_pages / wp_list_products** — browse all content
- **wp_get_post / wp_get_page** — read full content, meta, SEO fields by ID
- **wp_update_post / wp_update_page** — edit title, content, excerpt, slug, status, SEO meta fields
- **wp_create_post** — create new posts/content

## When to use WordPress tools:
- User asks to read/inspect page content, titles, meta descriptions → use wp_get_page/wp_get_post
- User asks to fix SEO issues (title, meta desc, content) → use wp_update_post/wp_update_page
- User asks to list/browse content → use wp_list_posts/wp_list_pages
- User asks to create new content → use wp_create_post

## SEO meta fields (Yoast / RankMath):
When updating SEO fields, use the meta object with keys like:
- _yoast_wpseo_title, _yoast_wpseo_metadesc (Yoast)
- rank_math_title, rank_math_description, rank_math_focus_keyword (RankMath)

## Rules:
- Reference specific numbers, keywords, pages from the data
- Be concise and action-oriented. Use markdown.
- When making changes, ALWAYS confirm what you changed and show before/after
- For write operations, execute them immediately — don't ask for confirmation unless the change is risky (deleting content, changing status to draft)

CURRENT SEO DATA:
${contextData}`;

    // Initialize WordPress client
    let wp: WPClient | null = null;
    try {
      wp = new WPClient();
    } catch {
      console.warn("WordPress client not available — read-only mode");
    }

    // Use tool-calling model (non-streaming) with loop for tool execution
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const MAX_TOOL_ROUNDS = 5;
    let finalContent = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "seo",
        messages: aiMessages,
        tools: wp ? wpTools : undefined,
      });

      // If no tool calls, we have the final answer
      if (!result.toolCalls?.length) {
        finalContent = result.content || "";
        break;
      }

      // Process tool calls — push the raw assistant message for context
      const rawMsg = result.raw?.choices?.[0]?.message;
      if (rawMsg) aiMessages.push(rawMsg);

      for (const toolCall of result.toolCalls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, any> = {};
        try {
          fnArgs = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments || {};
        } catch { /* empty args */ }

        console.log(`SEO Copilot tool call: ${fnName}`, fnArgs);

        const toolResult = wp
          ? await executeWpTool(wp, fnName, fnArgs)
          : JSON.stringify({ error: "WordPress not configured" });

        aiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // Stream the final content as SSE for frontend compatibility
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send content in chunks to simulate streaming
        const chunkSize = 50;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          const sseData = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }, { functionName: "seo-ai-copilot", requireCompany: false, wrapResult: false })
);