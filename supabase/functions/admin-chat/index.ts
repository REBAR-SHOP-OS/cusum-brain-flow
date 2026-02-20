import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { buildPageContext } from "../_shared/pageMap.ts";
import { WPClient } from "../_shared/wpClient.ts";
import { callAIStream, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══ JARVIS TOOLS ═══

const WRITE_TOOLS = new Set([
  "update_machine_status",
  "update_delivery_status",
  "update_lead_status",
  "update_cut_plan_status",
  "create_event",
  "wp_update_post",
  "wp_update_page",
  "wp_update_product",
  "wp_update_order_status",
  "wp_create_redirect",
  "wp_create_product",
  "wp_delete_product",
  "wp_create_post",
  "wp_optimize_speed",
]);

const JARVIS_TOOLS = [
  // Memory tools
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save something to persistent memory so you can recall it in future sessions.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["business", "personal", "reminder", "insight"], description: "Category of the memory" },
          content: { type: "string", description: "The content to remember" },
          expires_at: { type: "string", description: "Optional ISO date when this memory should expire" },
        },
        required: ["category", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Delete a memory by its ID when the user asks to forget something.",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "UUID of the memory to delete" },
        },
        required: ["memory_id"],
        additionalProperties: false,
      },
    },
  },
  // Read tools
  {
    type: "function",
    function: {
      name: "list_machines",
      description: "Query machines with optional status filter. Returns structured JSON with id, name, status, type.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["idle", "running", "blocked", "down"], description: "Filter by status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deliveries",
      description: "Query deliveries with optional status and date filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          date: { type: "string", description: "Filter by scheduled_date (YYYY-MM-DD)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "Query work orders with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_leads",
      description: "Query leads with optional status or minimum score filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          min_score: { type: "number", description: "Minimum lead_score" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_levels",
      description: "Query inventory stock levels, optionally filtered by bar_code.",
      parameters: {
        type: "object",
        properties: {
          bar_code: { type: "string", description: "Filter by specific bar code" },
        },
        additionalProperties: false,
      },
    },
  },
  // Write tools (require confirmation)
  {
    type: "function",
    function: {
      name: "update_machine_status",
      description: "Update the status of a machine. Requires user confirmation. Use list_machines first to get the ID.",
      parameters: {
        type: "object",
        properties: {
          machine_id: { type: "string", description: "UUID of the machine" },
          status: { type: "string", enum: ["idle", "running", "blocked", "down"], description: "New status" },
        },
        required: ["machine_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_delivery_status",
      description: "Update the status of a delivery. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          delivery_id: { type: "string", description: "UUID of the delivery" },
          status: { type: "string", description: "New status" },
        },
        required: ["delivery_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update the status of a lead. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID of the lead" },
          status: { type: "string", description: "New status" },
        },
        required: ["lead_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_cut_plan_status",
      description: "Update the status of a cut plan. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          cut_plan_id: { type: "string", description: "UUID of the cut plan" },
          status: { type: "string", enum: ["draft", "queued", "running", "completed", "canceled"], description: "New status" },
        },
        required: ["cut_plan_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Log an activity event. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", description: "Type of entity (e.g. machine, delivery, order)" },
          entity_id: { type: "string", description: "UUID of the entity" },
          event_type: { type: "string", description: "Type of event" },
          description: { type: "string", description: "Description of the event" },
        },
        required: ["entity_type", "event_type", "description"],
        additionalProperties: false,
      },
    },
  },
  // ─── WordPress Read Tools ───
  {
    type: "function",
    function: {
      name: "wp_list_posts",
      description: "List/search posts on rebar.shop with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "Filter by post status" },
          search: { type: "string", description: "Search term for post title/content" },
          per_page: { type: "string", description: "Number of results (max 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_list_pages",
      description: "List/search pages on rebar.shop.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "Filter by page status" },
          search: { type: "string", description: "Search term" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_list_products",
      description: "List WooCommerce products from rebar.shop with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["publish", "draft", "pending"], description: "Filter by product status" },
          search: { type: "string", description: "Search term for product name" },
          stock_status: { type: "string", enum: ["instock", "outofstock", "onbackorder"], description: "Filter by stock status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_list_orders",
      description: "List WooCommerce orders from rebar.shop with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"], description: "Filter by order status" },
          after: { type: "string", description: "Only orders after this ISO date" },
          before: { type: "string", description: "Only orders before this ISO date" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_get_site_health",
      description: "Get basic site health info from rebar.shop — recent posts count, pages count, and check if WooCommerce is active.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  // ─── WordPress Write Tools (require confirmation) ───
  {
    type: "function",
    function: {
      name: "wp_update_post",
      description: "Update a post on rebar.shop (title, content, status, or slug). Requires confirmation. Use wp_list_posts first to get the post ID.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "WordPress post ID" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "New status" },
          slug: { type: "string", description: "New URL slug (⚠️ suggest creating a redirect first)" },
        },
        required: ["post_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_update_page",
      description: "Update a page on rebar.shop. Requires confirmation. Use wp_list_pages first.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "WordPress page ID" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "New status" },
          slug: { type: "string", description: "New URL slug" },
        },
        required: ["page_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_update_product",
      description: "Update a WooCommerce product on rebar.shop. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "WooCommerce product ID" },
          regular_price: { type: "string", description: "New regular price" },
          sale_price: { type: "string", description: "New sale price" },
          stock_quantity: { type: "number", description: "New stock quantity" },
          stock_status: { type: "string", enum: ["instock", "outofstock", "onbackorder"], description: "Stock status" },
          status: { type: "string", enum: ["publish", "draft", "pending"], description: "Product status" },
          description: { type: "string", description: "New product description (HTML)" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_update_order_status",
      description: "Update the status of a WooCommerce order. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "WooCommerce order ID" },
          status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"], description: "New order status" },
        },
        required: ["order_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_create_redirect",
      description: "Create a 301 redirect on rebar.shop from old URL to new URL. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          from_url: { type: "string", description: "Old URL path (e.g. /old-page)" },
          to_url: { type: "string", description: "New URL path (e.g. /new-page)" },
        },
        required: ["from_url", "to_url"],
        additionalProperties: false,
      },
    },
  },
  // ─── New Read Tools ───
  {
    type: "function",
    function: {
      name: "wp_get_product",
      description: "Get full details of a single WooCommerce product by ID.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "WooCommerce product ID" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_get_page",
      description: "Get full details of a single WordPress page by ID.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "WordPress page ID" },
        },
        required: ["page_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_get_post",
      description: "Get full details of a single WordPress post by ID.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "WordPress post ID" },
        },
        required: ["post_id"],
        additionalProperties: false,
      },
    },
  },
  // ─── New Write Tools (require confirmation) ───
  {
    type: "function",
    function: {
      name: "wp_create_product",
      description: "Create a new WooCommerce product on rebar.shop. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Product name" },
          regular_price: { type: "string", description: "Regular price" },
          description: { type: "string", description: "Product description (HTML)" },
          short_description: { type: "string", description: "Short description (HTML)" },
          status: { type: "string", enum: ["publish", "draft", "pending"], description: "Product status" },
          stock_quantity: { type: "number", description: "Stock quantity" },
          manage_stock: { type: "boolean", description: "Whether to manage stock" },
          categories: { type: "string", description: "Comma-separated category IDs" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_delete_product",
      description: "Delete (trash) a WooCommerce product. Requires confirmation. Use wp_list_products or wp_get_product first.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "WooCommerce product ID" },
          force: { type: "boolean", description: "True to permanently delete instead of trashing" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_create_post",
      description: "Create a new blog post on rebar.shop. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Post title" },
          content: { type: "string", description: "Post content (HTML)" },
          status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "Post status" },
          categories: { type: "string", description: "Comma-separated category IDs" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  // ─── Speed Optimization Tools ───
  {
    type: "function",
    function: {
      name: "wp_run_speed_audit",
      description: "Run a speed audit on rebar.shop — measures TTFB, analyzes HTML for performance issues, and returns recommendations.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_optimize_speed",
      description: "Run the image optimizer on all WordPress content to add lazy loading, decoding=async. Requires confirmation. Set dry_run=false to actually apply changes.",
      parameters: {
        type: "object",
        properties: {
          dry_run: { type: "boolean", description: "If true (default), only shows what would change without modifying content" },
        },
        additionalProperties: false,
      },
    },
  },
  // ─── Page Inspection Tool ───
  {
    type: "function",
    function: {
      name: "wp_inspect_page",
      description: "Fetch and analyze the live HTML content of a page on rebar.shop. Use this when the user asks about what's on the current page, what a page looks like, or wants to inspect page content.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL or path on rebar.shop to inspect (e.g. /products or https://rebar.shop/about)" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
];

// ═══ READ TOOL EXECUTION ═══

async function executeReadTool(supabase: any, toolName: string, args: any): Promise<string> {
  switch (toolName) {
    case "list_machines": {
      let q = supabase.from("machines").select("id, name, status, type, current_operator_profile_id").limit(50);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_deliveries": {
      let q = supabase.from("deliveries").select("id, delivery_number, status, scheduled_date, driver_name, vehicle, notes").limit(50);
      if (args.status) q = q.eq("status", args.status);
      if (args.date) q = q.eq("scheduled_date", args.date);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_orders": {
      let q = supabase.from("work_orders").select("id, status, created_at, updated_at").limit(50);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_leads": {
      let q = supabase.from("leads").select("id, title, stage, expected_value, computed_score, priority").limit(50);
      if (args.stage) q = q.eq("stage", args.stage);
      if (args.min_score) q = q.gte("computed_score", args.min_score);
      q = q.order("computed_score", { ascending: false });
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "get_stock_levels": {
      let q = supabase.from("inventory_lots").select("id, bar_code, qty_on_hand, location").gt("qty_on_hand", 0).limit(50);
      if (args.bar_code) q = q.eq("bar_code", args.bar_code);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    // ─── WordPress Read Tools ───
    case "wp_list_posts": {
      try {
        const wp = new WPClient();
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        if (args.search) params.search = args.search;
        if (args.per_page) params.per_page = String(Math.min(Number(args.per_page), 20));
        const posts = await wp.listPosts(params);
        return JSON.stringify(Array.isArray(posts) ? posts.map((p: any) => ({
          id: p.id, title: p.title?.rendered, status: p.status, slug: p.slug, date: p.date, link: p.link,
        })) : posts);
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_list_pages": {
      try {
        const wp = new WPClient();
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        if (args.search) params.search = args.search;
        const pages = await wp.listPages(params);
        return JSON.stringify(Array.isArray(pages) ? pages.map((p: any) => ({
          id: p.id, title: p.title?.rendered, status: p.status, slug: p.slug, link: p.link,
        })) : pages);
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_list_products": {
      try {
        const wp = new WPClient();
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        if (args.search) params.search = args.search;
        if (args.stock_status) params.stock_status = args.stock_status;
        const products = await wp.listProducts(params);
        if (!Array.isArray(products)) return JSON.stringify(products);
        return JSON.stringify(products.map((p: any) => ({
          id: p.id, name: p.name, status: p.status, price: p.price, regular_price: p.regular_price,
          stock_quantity: p.stock_quantity, stock_status: p.stock_status, permalink: p.permalink,
        })));
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_list_orders": {
      try {
        const wp = new WPClient();
        const params: Record<string, string> = {};
        if (args.status) params.status = args.status;
        if (args.after) params.after = args.after;
        if (args.before) params.before = args.before;
        const orders = await wp.listOrders(params);
        if (!Array.isArray(orders)) return JSON.stringify(orders);
        return JSON.stringify(orders.map((o: any) => ({
          id: o.id, number: o.number, status: o.status, total: o.total, currency: o.currency,
          date_created: o.date_created, billing_name: `${o.billing?.first_name || ""} ${o.billing?.last_name || ""}`.trim(),
        })));
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_get_site_health": {
      try {
        const wp = new WPClient();
        let posts: any[] = [];
        let pages: any[] = [];
        try { posts = await wp.listPosts({ per_page: "1" }); } catch {}
        try { pages = await wp.listPages({ per_page: "1" }); } catch {}
        let wooActive = false;
        try { await wp.listProducts({ per_page: "1" }); wooActive = true; } catch {}
        return JSON.stringify({
          wp_active: true,
          has_posts: Array.isArray(posts) && posts.length > 0,
          has_pages: Array.isArray(pages) && pages.length > 0,
          woocommerce_active: wooActive,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    // ─── New Read Tools ───
    case "wp_get_product": {
      try {
        const wp = new WPClient();
        const product = await wp.getProduct(args.product_id);
        return JSON.stringify({
          id: product.id, name: product.name, status: product.status, slug: product.slug,
          price: product.price, regular_price: product.regular_price, sale_price: product.sale_price,
          stock_quantity: product.stock_quantity, stock_status: product.stock_status,
          description: product.description, short_description: product.short_description,
          categories: product.categories, images: product.images?.map((i: any) => i.src),
          permalink: product.permalink, sku: product.sku, weight: product.weight,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_get_page": {
      try {
        const wp = new WPClient();
        const page = await wp.getPage(args.page_id);
        return JSON.stringify({
          id: page.id, title: page.title?.rendered, status: page.status, slug: page.slug,
          content: page.content?.rendered?.slice(0, 2000), link: page.link, date: page.date,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_get_post": {
      try {
        const wp = new WPClient();
        const post = await wp.getPost(args.post_id);
        return JSON.stringify({
          id: post.id, title: post.title?.rendered, status: post.status, slug: post.slug,
          content: post.content?.rendered?.slice(0, 2000), link: post.link, date: post.date,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_run_speed_audit": {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const res = await fetch(`${supabaseUrl}/functions/v1/website-speed-audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        return JSON.stringify(data);
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    case "wp_inspect_page": {
      try {
        let url = args.url || "/";
        // Normalize to full URL
        if (url.startsWith("/")) url = `https://rebar.shop${url}`;
        else if (!url.startsWith("http")) url = `https://rebar.shop/${url}`;

        const res = await fetch(url, {
          headers: { "User-Agent": "RebarShopOS-Inspector/1.0" },
          redirect: "follow",
        });
        if (!res.ok) return JSON.stringify({ error: `Page returned ${res.status}`, url });

        const html = await res.text();

        // Extract meta tags
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i);
        const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([\s\S]*?)["']/i);

        // Extract headings
        const headings: { level: string; text: string }[] = [];
        const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
        let hMatch;
        while ((hMatch = headingRegex.exec(html)) !== null && headings.length < 30) {
          headings.push({ level: hMatch[1], text: hMatch[2].replace(/<[^>]*>/g, "").trim() });
        }

        // Extract links
        const links: { href: string; text: string }[] = [];
        const linkRegex = /<a[^>]*href=["']([\s\S]*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let lMatch;
        while ((lMatch = linkRegex.exec(html)) !== null && links.length < 50) {
          const href = lMatch[1].trim();
          const text = lMatch[2].replace(/<[^>]*>/g, "").trim();
          if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
            links.push({ href, text: text.slice(0, 80) });
          }
        }

        // Extract images
        const images: { src: string; alt: string }[] = [];
        const imgRegex = /<img[^>]*src=["']([\s\S]*?)["'][^>]*/gi;
        let iMatch;
        while ((iMatch = imgRegex.exec(html)) !== null && images.length < 30) {
          const altMatch = iMatch[0].match(/alt=["']([\s\S]*?)["']/i);
          images.push({ src: iMatch[1].trim(), alt: altMatch?.[1]?.trim() || "" });
        }

        // Extract text content (strip scripts, styles, nav, footer, then tags)
        let textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        textContent = textContent.slice(0, 4000);

        // Check for forms
        const formCount = (html.match(/<form/gi) || []).length;

        return JSON.stringify({
          url,
          title: titleMatch?.[1]?.trim() || null,
          meta_description: metaDescMatch?.[1]?.trim() || null,
          og: {
            title: ogTitleMatch?.[1]?.trim() || null,
            description: ogDescMatch?.[1]?.trim() || null,
            image: ogImageMatch?.[1]?.trim() || null,
          },
          canonical: canonicalMatch?.[1]?.trim() || null,
          headings,
          links_count: links.length,
          links: links.slice(0, 20),
          images_count: images.length,
          images: images.slice(0, 15),
          forms_count: formCount,
          text_content: textContent,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }
    default:
      return JSON.stringify({ error: `Unknown read tool: ${toolName}` });
  }
}

// ═══ WRITE TOOL EXECUTION (only called after confirmation) ═══

async function executeWriteTool(supabase: any, userId: string, companyId: string, toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case "update_machine_status": {
      const { data, error } = await supabase.from("machines").update({ status: args.status }).eq("id", args.machine_id).select().single();
      if (error) throw error;
      return { success: true, message: `Machine status changed to ${args.status}`, data };
    }
    case "update_delivery_status": {
      const { data, error } = await supabase.from("deliveries").update({ status: args.status }).eq("id", args.delivery_id).select().single();
      if (error) throw error;
      return { success: true, message: `Delivery status updated to ${args.status}`, data };
    }
    case "update_lead_status": {
      const { data, error } = await supabase.from("leads").update({ status: args.status }).eq("id", args.lead_id).select().single();
      if (error) throw error;
      return { success: true, message: `Lead status updated to ${args.status}`, data };
    }
    case "update_cut_plan_status": {
      const { data, error } = await supabase.from("cut_plans").update({ status: args.status }).eq("id", args.cut_plan_id).select().single();
      if (error) throw error;
      return { success: true, message: `Cut plan status updated to ${args.status}`, data };
    }
    case "create_event": {
      const { data, error } = await supabase.from("activity_events").insert({
        company_id: companyId,
        entity_type: args.entity_type,
        entity_id: args.entity_id || crypto.randomUUID(),
        event_type: args.event_type,
        description: args.description,
        actor_id: userId,
        actor_type: "jarvis",
        source: "system",
      }).select().single();
      if (error) throw error;
      return { success: true, message: `Event logged: ${args.event_type}`, data };
    }
    // ─── WordPress Write Tools ───
    case "wp_update_post": {
      const wp = new WPClient();
      const prev = await wp.getPost(args.post_id);
      const update: Record<string, unknown> = {};
      if (args.title) update.title = args.title;
      if (args.content) update.content = args.content;
      if (args.status) update.status = args.status;
      if (args.slug) update.slug = args.slug;
      const result = await wp.updatePost(args.post_id, update);
      await logWpChange(supabase, userId, `/posts/${args.post_id}`, "PUT", "post", args.post_id, prev, update);
      return { success: true, message: `Post "${result.title?.rendered || args.post_id}" updated` };
    }
    case "wp_update_page": {
      const wp = new WPClient();
      const prev = await wp.getPage(args.page_id);
      const update: Record<string, unknown> = {};
      if (args.title) update.title = args.title;
      if (args.content) update.content = args.content;
      if (args.status) update.status = args.status;
      if (args.slug) update.slug = args.slug;
      const result = await wp.updatePage(args.page_id, update);
      await logWpChange(supabase, userId, `/pages/${args.page_id}`, "PUT", "page", args.page_id, prev, update);
      return { success: true, message: `Page "${result.title?.rendered || args.page_id}" updated` };
    }
    case "wp_update_product": {
      const wp = new WPClient();
      const prev = await wp.getProduct(args.product_id);
      const update: Record<string, unknown> = {};
      if (args.regular_price) update.regular_price = args.regular_price;
      if (args.sale_price) update.sale_price = args.sale_price;
      if (args.stock_quantity !== undefined) update.stock_quantity = args.stock_quantity;
      if (args.stock_status) update.stock_status = args.stock_status;
      if (args.status) update.status = args.status;
      if (args.description) update.description = args.description;
      const result = await wp.updateProduct(args.product_id, update);
      await logWpChange(supabase, userId, `/wc/v3/products/${args.product_id}`, "PUT", "product", args.product_id, prev, update);
      return { success: true, message: `Product "${result.name || args.product_id}" updated` };
    }
    case "wp_update_order_status": {
      const wp = new WPClient();
      const prev = await wp.getOrder(args.order_id);
      const result = await wp.updateOrder(args.order_id, { status: args.status });
      await logWpChange(supabase, userId, `/wc/v3/orders/${args.order_id}`, "PUT", "order", args.order_id, { status: prev.status }, { status: args.status });
      return { success: true, message: `Order #${result.number || args.order_id} status → ${args.status}` };
    }
    case "wp_create_redirect": {
      // Use WordPress post meta or a redirect plugin. Fallback: create a draft page with meta refresh.
      const wp = new WPClient();
      const redirectHtml = `<!-- 301 Redirect --><meta http-equiv="refresh" content="0;url=${args.to_url}"><link rel="canonical" href="${args.to_url}">`;
      const slug = args.from_url.replace(/^\//, "").replace(/\/$/, "");
      const result = await wp.post("/pages", { title: `Redirect: ${args.from_url}`, content: redirectHtml, slug, status: "publish" });
      await logWpChange(supabase, userId, "/pages", "POST", "redirect", String(result.id), null, { from: args.from_url, to: args.to_url });
      return { success: true, message: `Redirect created: ${args.from_url} → ${args.to_url}` };
    }
    case "wp_create_product": {
      const wp = new WPClient();
      const productData: Record<string, unknown> = { name: args.name };
      if (args.regular_price) productData.regular_price = args.regular_price;
      if (args.description) productData.description = args.description;
      if (args.short_description) productData.short_description = args.short_description;
      if (args.status) productData.status = args.status;
      if (args.stock_quantity !== undefined) { productData.stock_quantity = args.stock_quantity; productData.manage_stock = true; }
      if (args.manage_stock !== undefined) productData.manage_stock = args.manage_stock;
      if (args.categories) productData.categories = args.categories.split(",").map((c: string) => ({ id: parseInt(c.trim()) }));
      const result = await wp.createProduct(productData);
      await logWpChange(supabase, userId, "/wc/v3/products", "POST", "product", String(result.id), null, productData);
      return { success: true, message: `Product "${result.name}" created (ID: ${result.id})` };
    }
    case "wp_delete_product": {
      const wp = new WPClient();
      const prev = await wp.getProduct(args.product_id);
      const result = await wp.deleteProduct(args.product_id, args.force === true);
      await logWpChange(supabase, userId, `/wc/v3/products/${args.product_id}`, "DELETE", "product", args.product_id, prev, { deleted: true, force: args.force });
      return { success: true, message: `Product "${prev.name || args.product_id}" ${args.force ? "permanently deleted" : "trashed"}` };
    }
    case "wp_create_post": {
      const wp = new WPClient();
      const postData: Record<string, unknown> = { title: args.title };
      if (args.content) postData.content = args.content;
      if (args.status) postData.status = args.status; else postData.status = "draft";
      if (args.categories) postData.categories = args.categories.split(",").map((c: string) => parseInt(c.trim()));
      const result = await wp.createPost(postData);
      await logWpChange(supabase, userId, "/posts", "POST", "post", String(result.id), null, postData);
      return { success: true, message: `Post "${result.title?.rendered || args.title}" created (ID: ${result.id})` };
    }
    case "wp_optimize_speed": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const dryRun = args.dry_run !== false;
      const res = await fetch(`${supabaseUrl}/functions/v1/wp-speed-optimizer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Optimizer failed");
      return {
        success: true,
        message: dryRun
          ? `Dry run complete: ${data.images_fixed} images can be optimized across ${data.items_modified} items (${data.items_scanned} scanned)`
          : `Optimized ${data.images_fixed} images across ${data.items_modified} items`,
        data,
      };
    }
    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}

async function logAction(supabase: any, userId: string, companyId: string, tool: string, args: any, result: any) {
  try {
    await supabase.from("activity_events").insert({
      company_id: companyId,
      entity_type: "jarvis_action",
      entity_id: args?.machine_id || args?.delivery_id || args?.lead_id || args?.cut_plan_id || args?.entity_id || crypto.randomUUID(),
      event_type: `jarvis_${tool}`,
      description: `JARVIS executed: ${tool} → ${result?.message || "done"}`,
      actor_id: userId,
      actor_type: "jarvis",
      metadata: { tool, args, result },
      source: "system",
      dedupe_key: `jarvis:${tool}:${JSON.stringify(args)}:${new Date().toISOString().slice(0, 16)}`,
    });
  } catch (_) { /* non-critical logging */ }
}

async function logWpChange(
  supabase: any, userId: string, endpoint: string, method: string,
  entityType: string, entityId: string, previousState: any, newState: any, errorMsg?: string,
) {
  try {
    await supabase.from("wp_change_log").insert({
      user_id: userId,
      endpoint,
      method,
      entity_type: entityType,
      entity_id: entityId,
      previous_state: previousState,
      new_state: newState,
      result: errorMsg ? "failed" : "success",
      error_message: errorMsg || null,
    });
  } catch (e: any) {
    console.error("wp_change_log insert error:", e.message);
  }
}

// ═══ MULTIMODAL IMAGE SUPPORT ═══

function buildMultimodalMessages(messages: any[], imageUrls?: string[]): any[] {
  if (!imageUrls || imageUrls.length === 0) return messages;

  // Transform the last user message to include image_url content blocks
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role === "user") {
      const textContent = typeof result[i].content === "string" ? result[i].content : "";
      result[i] = {
        role: "user",
        content: [
          { type: "text", text: textContent },
          ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
      break;
    }
  }
  return result;
}

// ═══ MAIN HANDLER ═══

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══ PUBLIC MODE (unauthenticated visitor chat) ═══
    const authHeader = req.headers.get("Authorization");
    const bodyClone = req.clone();
    let parsedBody: any;
    try { parsedBody = await bodyClone.json(); } catch { parsedBody = {}; }

    if (parsedBody.publicMode && !authHeader) {
      // Rate limit by IP
      const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const { data: allowed } = await supabase.rpc("check_rate_limit", {
        _user_id: `public_${visitorIp}`,
        _function_name: "public-chat",
        _max_requests: 10,
        _window_seconds: 60,
      });
      if (allowed === false) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const publicSystemPrompt = `You are Vizzy — a helpful assistant on the Rebar Shop website (rebar.shop).
You answer questions about rebar fabrication, estimating, steel reinforcement, pricing, and the Rebar Shop platform.
Keep answers concise, friendly, and professional. You do NOT have access to any internal business data, admin tools, or customer information.
If someone asks about placing an order or getting a quote, direct them to the contact form or tell them to call the office.
Never reveal internal system details. Respond in the same language the user writes in.`;

      const publicMessages = (parsedBody.messages || []).slice(-10);

      try {
        const aiResponse = await callAIStream({
          provider: "gpt",
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: publicSystemPrompt }, ...publicMessages],
          signal: AbortSignal.timeout(30000),
        });

        return new Response(aiResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (err: any) {
        const status = err instanceof AIError ? err.status : 500;
        return new Response(JSON.stringify({ error: err.message || "AI request failed" }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ═══ AUTHENTICATED MODE ═══
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role-based admin check
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Access denied. Admin role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit — increased to 40 req/60s to accommodate Gemini's higher throughput
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "admin-chat",
      _max_requests: 40,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Get company_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = profileData?.company_id || "a0000000-0000-0000-0000-000000000001";

    // ═══ CONFIRM ACTION PATH ═══
    if (body.confirm_action) {
      const { tool, args } = body.confirm_action;

      // Re-validate admin server-side
      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!WRITE_TOOLS.has(tool)) {
        return new Response(JSON.stringify({ error: `Invalid tool: ${tool}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await executeWriteTool(supabase, user.id, companyId, tool, args);
        await logAction(supabase, user.id, companyId, tool, args, result);

        // Return result as SSE so frontend can display in chat
        const encoder = new TextEncoder();
        const resultMsg = `✅ **Action Executed**\n\n${result.message}`;
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } catch (err: any) {
        const encoder = new TextEncoder();
        const errMsg = `❌ **Action Failed**\n\n${err.message || "Unknown error"}`;
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // ═══ NORMAL CHAT PATH ═══
    const { messages, currentPage, imageUrls } = body;

    const systemContext = await buildFullVizzyContext(supabase, user.id);
    const pageContext = buildPageContext(currentPage || "/chat");

    const systemPrompt = `You are JARVIS — the CEO's personal and business AI assistant for REBAR SHOP OS.
You handle EVERYTHING: business operations, personal tasks, brainstorming, scheduling, reminders, writing.
You have FULL access to live business data. You can diagnose issues, explain what's happening, suggest fixes, and provide actionable commands.
═══ LANGUAGE ═══
You are MULTILINGUAL. You MUST respond in whatever language the CEO speaks to you.
If the CEO speaks Farsi (Persian), respond in Farsi with a natural Tehrani accent and conversational tone — like a native Tehran speaker.
Use informal/colloquial Farsi when appropriate (e.g. "چطوری" not "حالتان چطور است", "الان" not "اکنون", "میخوای" not "می‌خواهید", "بذار" not "بگذارید").
You can seamlessly switch between English and Farsi mid-conversation. If the CEO code-switches (mixes Farsi and English / Finglish), match their style.
Keep business terms, company names, proper nouns, and technical terms in English even when responding in Farsi.
When fully in Farsi mode, you may use Persian numerals (۱۲۳) but always keep currency in USD format.

${pageContext}

${systemContext}

═══ YOUR CAPABILITIES ═══
BUSINESS:
- Diagnose production bottlenecks, idle machines, stock shortages
- Analyze recent events and surface anomalies
- Explain stuck orders, idle machines, low stock
- Suggest SQL queries or data fixes the admin can run
- Cross-reference data: AR high + production slow → flag it
- Monitor email inbox and surface urgent items

PERSONAL:
- Brainstorming and strategy sessions
- Writing emails, messages, notes
- Personal reminders and to-do tracking
- Journaling thoughts and ideas
- Scheduling suggestions

MEMORY:
- You have persistent memory across sessions
- When you learn something important, save it using save_memory
- Reference past memories when relevant
- When the user says "remember this" or similar, use save_memory
- You can delete memories when asked to forget

PROACTIVE INTELLIGENCE:
- If you notice anomalies in the data, mention them even if not asked
- Connect dots across departments
- Flag risks before they become problems

═══ TOOL USAGE RULES ═══
- You have READ tools (list_machines, list_deliveries, list_orders, list_leads, get_stock_levels) that execute immediately and return structured JSON.
- You have WRITE tools (update_machine_status, update_delivery_status, update_lead_status, update_cut_plan_status, create_event) that require user confirmation before executing.
- ALWAYS use read tools to retrieve current entity IDs before performing write operations. Never assume or hallucinate entity IDs.
- For write operations: call the write tool directly. Do NOT ask for confirmation in text — the system handles confirmation automatically via UI.
- If an entity is ambiguous (e.g. "that machine"), ask for clarification BEFORE calling a tool.
- Prefer tools over explanation when the request is actionable.
- When reporting read results, summarize naturally — don't dump raw JSON.

═══ WORDPRESS & WOOCOMMERCE MANAGEMENT (rebar.shop) ═══
- You have FULL read and write access to rebar.shop via WordPress REST API and WooCommerce REST API
- READ tools: wp_list_posts, wp_list_pages, wp_list_products, wp_list_orders, wp_get_site_health, wp_get_product, wp_get_page, wp_get_post, wp_inspect_page — execute immediately
- WRITE tools: wp_update_post, wp_update_page, wp_update_product, wp_update_order_status, wp_create_redirect, wp_create_product, wp_delete_product, wp_create_post — require user confirmation
- Use wp_get_product / wp_get_post / wp_get_page to get full details of a single item by ID
- Use wp_create_product to create new WooCommerce products (name, price, description, stock, status)
- Use wp_delete_product to trash or permanently delete products
- Use wp_create_post to create new blog posts (title, content, status)
- Use wp_list_* tools to inspect current state before making changes
- When changing URLs/slugs, ALWAYS suggest creating a redirect first using wp_create_redirect
- Never delete published content without explicit confirmation
- Changes are logged to wp_change_log for audit and rollback
- If a user says "undo last WordPress change", query wp_change_log and use previous_state to restore

═══ PAGE INSPECTION ═══
- Use wp_inspect_page to fetch and analyze the live HTML content of any page on rebar.shop
- The user's message includes "[Currently viewing: rebar.shop/path]" — use that path with wp_inspect_page when they ask about the current page
- This tool returns: title, meta tags, headings, links, images, forms count, and text content (truncated to ~4000 chars)
- Use it to answer questions like "what's on this page?", "check the SEO of this page", "what products are listed here?"

═══ WEBSITE SPEED OPTIMIZATION ═══
- Use wp_run_speed_audit to check current TTFB, page weight, and identify performance issues
- Use wp_optimize_speed to fix image-level issues (add lazy loading, decoding=async)
- wp_optimize_speed defaults to dry_run=true (preview only). Set dry_run=false to apply changes.
- The biggest speed win is installing a caching plugin (server-side) — always mention this

═══ RULES ═══
- Be direct and concise — this is for a power user
- Use markdown formatting: headers, bullet lists, code blocks for SQL
- If you see issues in live data, proactively mention them
- When suggesting fixes, be specific (table names, column values, exact steps)
- If you don't have enough data, say what additional info you'd need
- NEVER make up figures — use only the data provided
- Track topics discussed across the session

═══ IMAGE ANALYSIS ═══
- You can analyze images the user uploads (screenshots, photos, documents)
- Describe what you see in detail and answer questions about the image content
- For shop floor photos: identify machine status, rebar tags, quality issues, safety concerns
- For screenshots: identify UI elements, errors, or data shown`;
    // First call with tools (55s timeout to fail gracefully before edge function limit)
    // Use GPT-4o for main JARVIS call — best at structured tool use and reasoning
    // If images attached, use Gemini for multimodal
    // Use Gemini Pro for all calls (GPT quota exhausted; Gemini Pro for depth + multimodal)
    const hasImages = imageUrls && imageUrls.length > 0;
    const mainProvider = "gemini" as const;
    const mainModel = "gemini-2.5-pro";
    let aiResponse: Response;
    try {
      aiResponse = await callAIStream({
        provider: mainProvider,
        model: mainModel,
        messages: [{ role: "system", content: systemPrompt }, ...buildMultimodalMessages(messages, imageUrls)],
        tools: JARVIS_TOOLS,
        signal: AbortSignal.timeout(55000),
      });
    } catch (err: any) {
      console.error("AI fetch failed:", err.name, err.message);
      const status = err instanceof AIError ? err.status : (err.name === "AbortError" || err.name === "TimeoutError" ? 504 : 500);
      const msg = (err.name === "AbortError" || err.name === "TimeoutError") ? "AI request timed out. Try a simpler question." : err.message;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseBody = aiResponse.body;
    if (!responseBody) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read full response to check for tool calls
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let toolCalls: any[] = [];
    let hasToolCalls = false;
    let streamChunks: string[] = [];

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        streamChunks.push(line + "\n");

        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) fullText += delta.content;
          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id || "", function: { name: tc.function?.name || "", arguments: "" } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch { /* partial */ }
      }
    }

    // If tool calls were made, execute them and make a follow-up
    if (hasToolCalls && toolCalls.length > 0) {
      // Use a ReadableStream so we can send progress SSE events immediately
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();

      const sendSSE = (content: string) => {
        writer.write(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      };

      // Process tools and stream results in background
      (async () => {
        try {
          const pendingActions: any[] = [];

          // ── Categorize tool calls ──
          const memoryTools: any[] = [];
          const writeTools: any[] = [];
          const readTools: any[] = [];
          for (const tc of toolCalls) {
            const toolName = tc.function.name;
            if (toolName === "save_memory" || toolName === "delete_memory") memoryTools.push(tc);
            else if (WRITE_TOOLS.has(toolName)) writeTools.push(tc);
            else readTools.push(tc);
          }

          // ── Send progress indicator ──
          const toolNames = toolCalls.map((tc: any) => tc.function.name);
          const progressLabels: Record<string, string> = {
            wp_list_products: "products", wp_list_posts: "posts", wp_list_pages: "pages",
            wp_list_orders: "orders", wp_get_site_health: "site health",
            list_machines: "machines", list_deliveries: "deliveries", list_orders: "work orders",
            list_leads: "leads", get_stock_levels: "inventory",
            wp_get_product: "product details", wp_get_page: "page details", wp_get_post: "post details",
            wp_inspect_page: "page content",
          };
          const checking = toolNames.map((n: string) => progressLabels[n]).filter(Boolean);
          if (checking.length > 0) {
            sendSSE(`🔍 Checking ${checking.join(", ")}...\n\n`);
          }

          // ── Execute memory tools sequentially (fast) ──
          const toolResults: any[] = [];
          for (const tc of memoryTools) {
            let result = "";
            try {
              const args = JSON.parse(tc.function.arguments);
              if (tc.function.name === "save_memory") {
                const { error } = await supabase.from("vizzy_memory").insert({
                  user_id: user.id, category: args.category || "general",
                  content: args.content, expires_at: args.expires_at || null, company_id: companyId,
                });
                result = error ? `Error saving: ${error.message}` : `✅ Saved to memory [${args.category}]: "${args.content}"`;
              } else {
                const { error } = await supabase.from("vizzy_memory").delete().eq("id", args.memory_id).eq("user_id", user.id);
                result = error ? `Error deleting: ${error.message}` : "✅ Memory deleted";
              }
            } catch (e) { result = `Tool error: ${e instanceof Error ? e.message : "Unknown"}`; }
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
          }

          // ── Queue write tools for confirmation ──
          for (const tc of writeTools) {
            try {
              const args = JSON.parse(tc.function.arguments);
              pendingActions.push({ tool: tc.function.name, args, tool_call_id: tc.id });
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: `⏳ Action "${tc.function.name}" queued for user confirmation.` });
            } catch (e) {
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: `Tool error: ${e instanceof Error ? e.message : "Unknown"}` });
            }
          }

          // ── Execute ALL read tools in PARALLEL ──
          const readResults = await Promise.all(readTools.map(async (tc: any) => {
            let result = "";
            try {
              const args = JSON.parse(tc.function.arguments);
              result = await executeReadTool(supabase, tc.function.name, args);
            } catch (e) {
              result = `Tool error: ${e instanceof Error ? e.message : "Unknown"}`;
            }
            return { role: "tool" as const, tool_call_id: tc.id, content: result, toolName: tc.function.name };
          }));
          toolResults.push(...readResults);

          // ── Follow-up AI call with tool results (faster model, shorter timeout) ──
          const followUpMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
            {
              role: "assistant", content: fullText || null,
              tool_calls: toolCalls.map((tc: any) => ({
                id: tc.id, type: "function",
                function: { name: tc.function.name, arguments: tc.function.arguments },
              })),
            },
            ...toolResults.map((tr: any) => ({ role: tr.role, tool_call_id: tr.tool_call_id, content: tr.content })),
          ];

          // Follow-up: GPT-4o-mini for speed (summarizing tool results)
          let followUpResp: Response;
          try {
            followUpResp = await callAIStream({
              provider: "gpt",
              model: "gpt-4o-mini",
              messages: followUpMessages,
              signal: AbortSignal.timeout(25000),
            });
          } catch (followErr: any) {
            console.error("Follow-up AI fetch failed:", followErr.name, followErr.message);
            // ── Graceful fallback: format raw tool results ──
            sendSSE("\n\n---\n\n");
            for (const tr of readResults) {
              const label = progressLabels[tr.toolName] || tr.toolName;
              try {
                const parsed = JSON.parse(tr.content);
                if (Array.isArray(parsed)) {
                  sendSSE(`**${label}** (${parsed.length} items):\n`);
                  for (const item of parsed.slice(0, 10)) {
                    const name = item.name || item.title || item.delivery_number || item.contact_name || item.id;
                    sendSSE(`- ${name}${item.status ? ` (${item.status})` : ""}${item.price ? ` — $${item.price}` : ""}\n`);
                  }
                } else {
                  sendSSE(`**${label}:** ${JSON.stringify(parsed).slice(0, 300)}\n`);
                }
              } catch { sendSSE(`**${label}:** ${tr.content.slice(0, 300)}\n`); }
              sendSSE("\n");
            }
            // Send pending actions
            for (const pa of pendingActions) {
              const desc = buildActionDescription(pa.tool, pa.args);
              writer.write(enc.encode(`event: pending_action\ndata: ${JSON.stringify({ tool: pa.tool, args: pa.args, description: desc })}\n\n`));
            }
            writer.write(enc.encode("data: [DONE]\n\n"));
            writer.close();
            return;
          }
          

          if (!followUpResp.ok) {
            sendSSE(`\n\n_Tool data retrieved but AI summary failed. Raw data above._`);
            for (const pa of pendingActions) {
              const desc = buildActionDescription(pa.tool, pa.args);
              writer.write(enc.encode(`event: pending_action\ndata: ${JSON.stringify({ tool: pa.tool, args: pa.args, description: desc })}\n\n`));
            }
            writer.write(enc.encode("data: [DONE]\n\n"));
            writer.close();
            return;
          }

          // ── Stream follow-up response directly to client ──
          const followReader = followUpResp.body!.getReader();
          const followDecoder = new TextDecoder();
          let followBuf = "";

          // Clear the progress message by starting fresh content
          sendSSE("");

          while (true) {
            const { done, value } = await followReader.read();
            if (done) break;
            followBuf += followDecoder.decode(value, { stream: true });

            let nl2: number;
            while ((nl2 = followBuf.indexOf("\n")) !== -1) {
              let line2 = followBuf.slice(0, nl2);
              followBuf = followBuf.slice(nl2 + 1);
              if (line2.endsWith("\r")) line2 = line2.slice(0, -1);
              if (line2.startsWith("data: ") && line2.slice(6).trim() !== "[DONE]") {
                writer.write(enc.encode(line2 + "\n"));
              }
            }
          }

          // Send pending actions after AI response
          for (const pa of pendingActions) {
            const desc = buildActionDescription(pa.tool, pa.args);
            writer.write(enc.encode(`event: pending_action\ndata: ${JSON.stringify({ tool: pa.tool, args: pa.args, description: desc })}\n\n`));
          }

          writer.write(enc.encode("data: [DONE]\n\n"));
          writer.close();
        } catch (bgErr) {
          console.error("Background tool processing error:", bgErr);
          try {
            sendSSE(`\n\n⚠️ Error processing tools: ${bgErr instanceof Error ? bgErr.message : "Unknown error"}`);
            writer.write(enc.encode("data: [DONE]\n\n"));
            writer.close();
          } catch { /* writer may be closed */ }
        }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — reconstruct the SSE stream
    const encoder = new TextEncoder();
    const ssePayload = streamChunks.join("") + "data: [DONE]\n\n";
    return new Response(encoder.encode(ssePayload), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildActionDescription(tool: string, args: any): string {
  switch (tool) {
    case "update_machine_status":
      return `Change machine ${args.machine_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_delivery_status":
      return `Change delivery ${args.delivery_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_lead_status":
      return `Change lead ${args.lead_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_cut_plan_status":
      return `Change cut plan ${args.cut_plan_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "create_event":
      return `Log event: ${args.event_type} — ${args.description || ""}`;
    // WordPress write tools
    case "wp_update_post":
      return `Update post #${args.post_id}${args.title ? ` title → "${args.title}"` : ""}${args.status ? ` status → ${args.status}` : ""}`;
    case "wp_update_page":
      return `Update page #${args.page_id}${args.title ? ` title → "${args.title}"` : ""}${args.status ? ` status → ${args.status}` : ""}`;
    case "wp_update_product":
      return `Update product #${args.product_id}${args.regular_price ? ` price → $${args.regular_price}` : ""}${args.stock_quantity !== undefined ? ` stock → ${args.stock_quantity}` : ""}`;
    case "wp_update_order_status":
      return `Change order #${args.order_id} status → "${args.status}"`;
    case "wp_create_redirect":
      return `Create redirect: ${args.from_url} → ${args.to_url}`;
    case "wp_create_product":
      return `Create product: "${args.name}"${args.regular_price ? ` @ $${args.regular_price}` : ""}`;
    case "wp_delete_product":
      return `Delete product #${args.product_id}${args.force ? " (permanent)" : ""}`;
    case "wp_create_post":
      return `Create post: "${args.title}"${args.status ? ` (${args.status})` : ""}`;
    default:
      return `Execute ${tool}`;
  }
}
