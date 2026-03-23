import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
  "rc_make_call",
  "rc_send_sms",
  "rc_send_fax",
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
  // ─── Employee Activity & Email Query Tools ───
  {
    type: "function",
    function: {
      name: "get_employee_activity",
      description: "Query activity logs for a specific employee by name or for all employees. Returns what they did, when, and on which entity. Use to answer 'what did X do today?' questions.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string", description: "Employee name (partial match). Leave empty for all employees." },
          date: { type: "string", description: "Date filter YYYY-MM-DD. Defaults to today." },
          limit: { type: "number", description: "Max results (default 50)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employee_emails",
      description: "Query emails sent or received by a specific employee. Returns subjects, recipients, timestamps. Use to answer 'what emails did X send?' questions.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string", description: "Employee name (partial match). Leave empty for all." },
          date: { type: "string", description: "Date filter YYYY-MM-DD. Defaults to today." },
          direction: { type: "string", enum: ["inbound", "outbound", "all"], description: "Email direction filter. Default: all" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ─── RingCentral Read Tools ───
  {
    type: "function",
    function: {
      name: "rc_get_active_calls",
      description: "Get currently active calls on the company's RingCentral account. Returns live call sessions with direction, from/to, status, and duration.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "rc_get_team_presence",
      description: "Get the DND/availability/telephony status of all RingCentral extensions in the company. Shows who is available, busy, on a call, or in DND.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "rc_get_call_analytics",
      description: "Pull call analytics from the communications table — total calls, per-employee breakdown, missed calls, average duration. Supports date filtering.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date filter YYYY-MM-DD. Defaults to today." },
          days: { type: "number", description: "Number of days to look back (alternative to date). Default: 1" },
        },
        additionalProperties: false,
      },
    },
  },
  // ─── RingCentral Write Tools (require confirmation) ───
  {
    type: "function",
    function: {
      name: "rc_make_call",
      description: "Initiate a RingOut call via RingCentral. Rings the company phone first, then connects to the destination number. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Destination phone number (E.164 format, e.g. +14155551234)" },
          from: { type: "string", description: "Caller ID / from number. Optional — uses default extension if omitted." },
        },
        required: ["to"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rc_send_sms",
      description: "Send an SMS message via RingCentral. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient phone number (E.164 format)" },
          text: { type: "string", description: "SMS message body" },
        },
        required: ["to", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rc_send_fax",
      description: "Send a fax via RingCentral. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Fax number (E.164 format)" },
          cover_page_text: { type: "string", description: "Cover page text for the fax" },
        },
        required: ["to"],
        additionalProperties: false,
      },
    },
  },
  // ─── Deep Business Scan Tool ───
  {
    type: "function",
    function: {
      name: "deep_business_scan",
      description: "Comprehensive cross-domain intelligence scan across emails, pipeline, calls, activity, production, financials, deliveries, and agent usage. Use when the user asks to 'deep scan', 'learn everything', 'audit the business', or wants a multi-day overview of all operations.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date YYYY-MM-DD. Defaults to 7 days ago." },
          date_to: { type: "string", description: "End date YYYY-MM-DD. Defaults to today." },
          focus: { type: "string", enum: ["all", "emails", "pipeline", "production", "financials", "calls", "activity"], description: "Focus area. Default: all" },
          employee_name: { type: "string", description: "Optional: filter everything to a specific employee by name" },
        },
        additionalProperties: false,
      },
    },
  },
  // ─── Investigate Entity Tool ───
  {
    type: "function",
    function: {
      name: "investigate_entity",
      description: "Search across ALL business data by keyword — project name, customer, person, or any term. Use when CEO asks about a specific project, customer, or topic. Searches customers, leads, emails, calls, orders, deliveries, production, financials, activity, and QuickBooks records.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword to search: project name, customer name, person name, or any term" },
          date_from: { type: "string", description: "Optional start date YYYY-MM-DD for time-scoped results" },
          date_to: { type: "string", description: "Optional end date YYYY-MM-DD" },
          include: {
            type: "array",
            items: { type: "string", enum: ["customers", "leads", "orders", "emails", "activity", "deliveries", "production", "financials", "calls", "contacts"] },
            description: "Domains to search. Default: all.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

const RC_SERVER = "https://platform.ringcentral.com";

async function getRingCentralToken(supabase: any, companyId: string): Promise<{ accessToken: string; userId: string } | null> {
  // Get all users in company
  const { data: companyProfiles } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("company_id", companyId);
  if (!companyProfiles?.length) return null;

  const userIds = companyProfiles.map((p: any) => p.user_id);
  const { data: tokenRow } = await supabase
    .from("user_ringcentral_tokens")
    .select("access_token, token_expires_at, refresh_token, user_id")
    .in("user_id", userIds)
    .order("token_expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) return null;

  let accessToken = tokenRow.access_token;

  // Refresh if expired
  if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) <= new Date()) {
    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    if (!clientId || !clientSecret || !tokenRow.refresh_token) return null;

    const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
      }),
    });
    if (!resp.ok) return null;
    const tokens = await resp.json();
    accessToken = tokens.access_token;
    await supabase.from("user_ringcentral_tokens").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || tokenRow.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }).eq("user_id", tokenRow.user_id);
  }

  return { accessToken, userId: tokenRow.user_id };
}

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
    // ─── Employee Activity Tool ───
    case "get_employee_activity": {
      const date = args.date || new Date().toISOString().split("T")[0];
      const limit = Math.min(args.limit || 50, 200);
      
      // Resolve employee name to user_id via profiles
      let actorIds: string[] | null = null;
      if (args.employee_name) {
        const { data: matchedProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .ilike("full_name", `%${args.employee_name}%`);
        if (!matchedProfiles || matchedProfiles.length === 0) {
          return JSON.stringify({ message: `No employee found matching "${args.employee_name}"`, results: [] });
        }
        actorIds = matchedProfiles.map((p: any) => p.user_id).filter(Boolean);
      }

      let q = supabase
        .from("activity_events")
        .select("event_type, entity_type, entity_id, description, actor_id, actor_type, source, created_at, metadata")
        .gte("created_at", date + "T00:00:00")
        .lte("created_at", date + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (actorIds && actorIds.length > 0) {
        q = q.in("actor_id", actorIds);
      }

      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });

      // Enrich with profile names
      const uniqueActorIds = [...new Set((data || []).map((e: any) => e.actor_id).filter(Boolean))];
      const { data: actorProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", uniqueActorIds.length > 0 ? uniqueActorIds : ["none"]);
      const nameMap = new Map((actorProfiles || []).map((p: any) => [p.user_id, p.full_name]));

      const enriched = (data || []).map((e: any) => ({
        ...e,
        actor_name: nameMap.get(e.actor_id) || "Unknown",
      }));

      return JSON.stringify({ date, total: enriched.length, results: enriched });
    }

    // ─── Employee Email Tool ───
    case "get_employee_emails": {
      const date = args.date || new Date().toISOString().split("T")[0];
      const limit = Math.min(args.limit || 30, 100);
      const direction = args.direction || "all";

      // Resolve employee name to email addresses
      let emailFilter: string[] | null = null;
      if (args.employee_name) {
        const { data: matchedProfiles } = await supabase
          .from("profiles")
          .select("email, full_name")
          .ilike("full_name", `%${args.employee_name}%`);
        if (!matchedProfiles || matchedProfiles.length === 0) {
          return JSON.stringify({ message: `No employee found matching "${args.employee_name}"`, results: [] });
        }
        emailFilter = matchedProfiles.map((p: any) => p.email).filter(Boolean);
      }

      let q = supabase
        .from("communications")
        .select("subject, from_address, to_address, body_preview, direction, received_at, ai_urgency, thread_id")
        .gte("received_at", date + "T00:00:00")
        .lte("received_at", date + "T23:59:59")
        .order("received_at", { ascending: false })
        .limit(limit);
      
      if (direction !== "all") {
        q = q.eq("direction", direction);
      }

      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });

      // Filter by employee email if specified
      let results = data || [];
      if (emailFilter && emailFilter.length > 0) {
        results = results.filter((e: any) => {
          const fromMatch = emailFilter!.some((em) => e.from_address?.toLowerCase().includes(em.toLowerCase()));
          const toMatch = emailFilter!.some((em) => e.to_address?.toLowerCase().includes(em.toLowerCase()));
          return fromMatch || toMatch;
        });
      }

      return JSON.stringify({ date, direction, total: results.length, results: results.map((e: any) => ({
        subject: e.subject,
        from: e.from_address,
        to: e.to_address,
        direction: e.direction,
        preview: e.body_preview?.slice(0, 500),
        urgency: e.ai_urgency,
        time: e.received_at,
        thread_id: e.thread_id,
      }))});
    }

    // ─── RingCentral Read Tools ───
    case "rc_get_active_calls": {
      try {
        // Get companyId from the supabase context — we need it for token lookup
        // The supabase client here is service-role, so we query for any company's RC token
        const { data: allTokens } = await supabase
          .from("user_ringcentral_tokens")
          .select("access_token, token_expires_at, refresh_token, user_id")
          .order("token_expires_at", { ascending: false })
          .limit(1);
        if (!allTokens?.length) return JSON.stringify({ message: "No RingCentral connection found" });
        
        const tokenRow = allTokens[0];
        let accessToken = tokenRow.access_token;
        if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) <= new Date()) {
          const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
          const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
          if (!clientId || !clientSecret || !tokenRow.refresh_token) return JSON.stringify({ error: "RC token expired, cannot refresh" });
          const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token }),
          });
          if (!resp.ok) return JSON.stringify({ error: "Token refresh failed" });
          const tokens = await resp.json();
          accessToken = tokens.access_token;
          await supabase.from("user_ringcentral_tokens").update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || tokenRow.refresh_token,
            token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          }).eq("user_id", tokenRow.user_id);
        }

        const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/active-calls?view=Detailed`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return JSON.stringify({ error: `RC API error: ${resp.status}` });
        const data = await resp.json();
        const calls = (data.records || []).map((c: any) => ({
          id: c.id, sessionId: c.sessionId, direction: c.direction,
          from: c.from?.phoneNumber || c.from?.name || "Unknown",
          to: c.to?.phoneNumber || c.to?.name || "Unknown",
          status: c.telephonyStatus || c.result || "Active",
          startTime: c.startTime, duration: c.duration || 0,
        }));
        return JSON.stringify({ activeCalls: calls, total: calls.length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "rc_get_team_presence": {
      try {
        const { data: allTokens } = await supabase
          .from("user_ringcentral_tokens")
          .select("access_token, token_expires_at, refresh_token, user_id")
          .order("token_expires_at", { ascending: false });
        if (!allTokens?.length) return JSON.stringify({ message: "No RingCentral connections found" });

        const presenceResults: any[] = [];
        const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
        const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");

        for (const row of allTokens) {
          let accessToken = row.access_token;
          if (row.token_expires_at && new Date(row.token_expires_at) <= new Date()) {
            if (!clientId || !clientSecret || !row.refresh_token) continue;
            try {
              const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
                body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
              });
              if (!resp.ok) continue;
              const tokens = await resp.json();
              accessToken = tokens.access_token;
              await supabase.from("user_ringcentral_tokens").update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || row.refresh_token,
                token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
              }).eq("user_id", row.user_id);
            } catch { continue; }
          }

          try {
            const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/presence`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!resp.ok) continue;
            const data = await resp.json();
            // Get user name
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", row.user_id).maybeSingle();
            presenceResults.push({
              user_id: row.user_id,
              name: profile?.full_name || "Unknown",
              status: data.presenceStatus || data.userStatus || "Offline",
              dnd_status: data.dndStatus || null,
              telephony_status: data.telephonyStatus || null,
            });
          } catch { continue; }
        }
        return JSON.stringify({ presenceData: presenceResults, total: presenceResults.length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "rc_get_call_analytics": {
      try {
        const today = new Date().toISOString().split("T")[0];
        const days = args.days || 1;
        const startDate = args.date || (days === 1 ? today : new Date(Date.now() - (days - 1) * 86400000).toISOString().split("T")[0]);
        const endDate = args.date || today;

        // Query actual communications schema — call data lives in metadata
        const { data: rows, error } = await supabase
          .from("communications")
          .select("direction, from_address, to_address, received_at, metadata, user_id")
          .eq("source", "ringcentral")
          .gte("received_at", startDate + "T00:00:00")
          .lte("received_at", endDate + "T23:59:59")
          .order("received_at", { ascending: false })
          .limit(500);

        if (error) return JSON.stringify({ error: error.message });

        // Filter to actual calls (metadata.type === "call")
        const calls = (rows || []).filter((r: any) => {
          const meta = r.metadata as Record<string, unknown> | null;
          return meta?.type === "call";
        });

        // Collect unique user_ids to resolve employee names
        const userIds = [...new Set(calls.map((c: any) => c.user_id).filter(Boolean))];
        let profileMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name || "Unknown"]));
        }

        // Derive analytics from metadata
        let totalMissed = 0;
        let totalInbound = 0;
        let totalOutbound = 0;
        let totalDuration = 0;
        const byEmployee: Record<string, { total: number; missed: number; inbound: number; outbound: number; totalDuration: number }> = {};

        for (const c of calls) {
          const meta = c.metadata as Record<string, unknown> | null;
          const dir = (c.direction || "inbound").toLowerCase();
          const result = (meta?.result as string) || "Unknown";
          const duration = (meta?.duration as number) || 0;
          const isMissed = result === "Missed" || result === "No Answer";

          if (dir === "inbound") totalInbound++;
          else totalOutbound++;
          if (isMissed) totalMissed++;
          totalDuration += duration;

          const name = profileMap.get(c.user_id) || "Unknown";
          if (!byEmployee[name]) byEmployee[name] = { total: 0, missed: 0, inbound: 0, outbound: 0, totalDuration: 0 };
          byEmployee[name].total++;
          if (isMissed) byEmployee[name].missed++;
          if (dir === "inbound") byEmployee[name].inbound++;
          if (dir === "outbound") byEmployee[name].outbound++;
          byEmployee[name].totalDuration += duration;
        }

        const total = calls.length;
        const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

        return JSON.stringify({
          period: { from: startDate, to: endDate },
          summary: { total, inbound: totalInbound, outbound: totalOutbound, missed: totalMissed, avgDurationSeconds: avgDuration },
          byEmployee,
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    // ─── Deep Business Scan ───
    case "deep_business_scan": {
      try {
        const today = new Date().toISOString().split("T")[0];
        const dateTo = args.date_to || today;
        const dateFrom = args.date_from || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        const focus = args.focus || "all";
        const scanAll = focus === "all";

        // Resolve employee if specified
        let employeeUserIds: string[] | null = null;
        let employeeEmails: string[] | null = null;
        let employeeName = args.employee_name || null;
        if (employeeName) {
          const { data: matchedProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .ilike("full_name", `%${employeeName}%`);
          if (matchedProfiles?.length) {
            employeeUserIds = matchedProfiles.map((p: any) => p.user_id).filter(Boolean);
            employeeEmails = matchedProfiles.map((p: any) => p.email).filter(Boolean);
            employeeName = matchedProfiles[0].full_name;
          } else {
            return JSON.stringify({ error: `No employee found matching "${args.employee_name}"` });
          }
        }

        const result: Record<string, unknown> = { period: { from: dateFrom, to: dateTo }, focus, employee: employeeName };

        // Build parallel queries based on focus
        const queries: Promise<void>[] = [];

        // 1. EMAILS
        if (scanAll || focus === "emails") {
          queries.push((async () => {
            let q = supabase
              .from("communications")
              .select("subject, from_address, to_address, body_preview, direction, received_at, ai_urgency, ai_category, thread_id, source")
              .gte("received_at", dateFrom + "T00:00:00")
              .lte("received_at", dateTo + "T23:59:59")
              .order("received_at", { ascending: false })
              .limit(200);
            const { data } = await q;
            let emails = data || [];
            // Filter by employee email if specified
            if (employeeEmails?.length) {
              emails = emails.filter((e: any) =>
                employeeEmails!.some((em) =>
                  e.from_address?.toLowerCase().includes(em.toLowerCase()) ||
                  e.to_address?.toLowerCase().includes(em.toLowerCase())
                )
              );
            }
            // Separate calls vs emails
            const emailItems = emails.filter((e: any) => e.source === "gmail");
            const callItems = emails.filter((e: any) => e.source === "ringcentral");
            
            // Find unanswered inbound (inbound with no corresponding outbound to same address)
            const inbound = emailItems.filter((e: any) => e.direction === "inbound");
            const outboundAddresses = new Set(emailItems.filter((e: any) => e.direction === "outbound").map((e: any) => e.to_address?.toLowerCase()));
            const unanswered = inbound.filter((e: any) => !outboundAddresses.has(e.from_address?.toLowerCase()));

            // Thread grouping
            const threadMap: Record<string, { subject: string; participants: Set<string>; count: number; latest: string; firstDirection: string; lastDirection: string; messages: any[] }> = {};
            for (const e of emailItems) {
              const tid = e.thread_id || e.subject || "unknown";
              if (!threadMap[tid]) {
                threadMap[tid] = { subject: e.subject, participants: new Set(), count: 0, latest: e.received_at, firstDirection: e.direction, lastDirection: e.direction, messages: [] };
              }
              const t = threadMap[tid];
              t.count++;
              if (e.from_address) t.participants.add(e.from_address.toLowerCase());
              if (e.to_address) t.participants.add(e.to_address.toLowerCase());
              if (e.received_at > t.latest) { t.latest = e.received_at; t.lastDirection = e.direction; }
              t.messages.push(e);
            }
            const threads = Object.entries(threadMap).map(([tid, t]) => ({
              threadId: tid,
              subject: t.subject,
              participants: [...t.participants],
              messageCount: t.count,
              latestTime: t.latest,
              lastDirection: t.lastDirection,
              needsReply: t.lastDirection === "inbound",
            })).sort((a, b) => b.latestTime.localeCompare(a.latestTime));

            result.emails = {
              total: emailItems.length,
              sent: emailItems.filter((e: any) => e.direction === "outbound").length,
              received: inbound.length,
              unanswered: unanswered.length,
              threadCount: threads.length,
              threadsNeedingReply: threads.filter(t => t.needsReply).length,
              threads: threads.slice(0, 30),
              unansweredItems: unanswered.slice(0, 25).map((e: any) => ({
                subject: e.subject, from: e.from_address, time: e.received_at, urgency: e.ai_urgency,
                preview: e.body_preview?.slice(0, 800), thread_id: e.thread_id,
              })),
              recentItems: emailItems.slice(0, 50).map((e: any) => ({
                subject: e.subject, from: e.from_address, to: e.to_address,
                direction: e.direction, time: e.received_at, urgency: e.ai_urgency, category: e.ai_category,
                preview: e.body_preview?.slice(0, 800), thread_id: e.thread_id,
              })),
            };
            if (scanAll || focus === "calls") {
              result.calls = { total: callItems.length, items: callItems.slice(0, 20).map((c: any) => ({
                from: c.from_address, to: c.to_address, direction: c.direction, time: c.received_at,
              })) };
            }
          })());
        }

        // 2. PIPELINE
        if (scanAll || focus === "pipeline") {
          queries.push((async () => {
            const { data: leads } = await supabase
              .from("leads")
              .select("id, title, stage, expected_value, computed_score, priority, created_at, updated_at, contact_name, contact_email")
              .in("stage", ["new", "contacted", "qualified", "proposal", "negotiation"])
              .order("computed_score", { ascending: false })
              .limit(100);
            const allLeads = leads || [];
            const hotLeads = allLeads.filter((l: any) => (l.computed_score || 0) >= 70);
            const totalValue = allLeads.reduce((s: number, l: any) => s + (l.expected_value || 0), 0);
            result.pipeline = {
              activeLeads: allLeads.length,
              hotLeads: hotLeads.length,
              totalPipelineValue: Math.round(totalValue * 100) / 100,
              topLeads: allLeads.slice(0, 15).map((l: any) => ({
                title: l.title, stage: l.stage, value: l.expected_value, score: l.computed_score,
                contact: l.contact_name, updated: l.updated_at,
              })),
            };
          })());
        }

        // 3. ACTIVITY
        if (scanAll || focus === "activity") {
          queries.push((async () => {
            let q = supabase
              .from("activity_events")
              .select("event_type, entity_type, description, actor_id, created_at, source")
              .gte("created_at", dateFrom + "T00:00:00")
              .lte("created_at", dateTo + "T23:59:59")
              .order("created_at", { ascending: false })
              .limit(200);
            if (employeeUserIds?.length) q = q.in("actor_id", employeeUserIds);
            const { data } = await q;
            const events = data || [];
            // Get actor names
            const actorIds = [...new Set(events.map((e: any) => e.actor_id).filter(Boolean))];
            let nameMap = new Map<string, string>();
            if (actorIds.length > 0) {
              const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds);
              nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
            }
            // Summarize by employee
            const byEmployee: Record<string, number> = {};
            const byType: Record<string, number> = {};
            for (const e of events) {
              const name = nameMap.get(e.actor_id) || "System";
              byEmployee[name] = (byEmployee[name] || 0) + 1;
              byType[e.event_type] = (byType[e.event_type] || 0) + 1;
            }
            result.activity = {
              totalEvents: events.length,
              byEmployee,
              byEventType: byType,
              recentEvents: events.slice(0, 20).map((e: any) => ({
                type: e.event_type, entity: e.entity_type, description: e.description,
                actor: nameMap.get(e.actor_id) || "System", time: e.created_at,
              })),
            };
          })());
        }

        // 4. PRODUCTION
        if (scanAll || focus === "production") {
          queries.push((async () => {
            const [{ data: cutItems }, { data: workOrders }] = await Promise.all([
              supabase.from("cut_plan_items")
                .select("id, phase, completed_pieces, total_pieces, bar_code")
                .in("phase", ["queued", "cutting", "bending", "cut_done"])
                .limit(500),
              supabase.from("work_orders")
                .select("id, status, created_at, updated_at")
                .gte("created_at", dateFrom + "T00:00:00")
                .limit(100),
            ]);
            const items = cutItems || [];
            const totalPieces = items.reduce((s: number, i: any) => s + (i.total_pieces || 0), 0);
            const completedPieces = items.reduce((s: number, i: any) => s + (i.completed_pieces || 0), 0);
            const byPhase: Record<string, number> = {};
            for (const i of items) byPhase[i.phase] = (byPhase[i.phase] || 0) + 1;
            result.production = {
              activeItems: items.length,
              totalPieces, completedPieces,
              progressPercent: totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0,
              byPhase,
              workOrders: (workOrders || []).length,
            };
          })());
        }

        // 5. FINANCIALS
        if (scanAll || focus === "financials") {
          queries.push((async () => {
            const [{ data: arData }, { data: apData }] = await Promise.all([
              supabase.from("accounting_mirror").select("balance, data").eq("entity_type", "Invoice").gt("balance", 0).limit(200),
              supabase.from("accounting_mirror").select("balance, data").eq("entity_type", "Vendor").gt("balance", 0).limit(200),
            ]);
            const totalAR = (arData || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);
            const overdueAR = (arData || []).filter((r: any) => r.data?.DueDate && r.data.DueDate < today);
            const totalOverdueAR = overdueAR.reduce((s: number, r: any) => s + (r.balance || 0), 0);
            const totalAP = (apData || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);
            result.financials = {
              totalAR: Math.round(totalAR * 100) / 100,
              overdueAR: Math.round(totalOverdueAR * 100) / 100,
              overdueInvoiceCount: overdueAR.length,
              totalAP: Math.round(totalAP * 100) / 100,
            };
          })());
        }

        // 6. DELIVERIES
        if (scanAll) {
          queries.push((async () => {
            const { data: deliveries } = await supabase
              .from("deliveries")
              .select("id, status, scheduled_date, delivery_number")
              .gte("scheduled_date", dateFrom)
              .lte("scheduled_date", dateTo)
              .limit(100);
            const all = deliveries || [];
            const byStatus: Record<string, number> = {};
            for (const d of all) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
            result.deliveries = { total: all.length, byStatus };
          })());
        }

        // 7. AGENT USAGE
        if (scanAll) {
          queries.push((async () => {
            const { data: sessions } = await supabase
              .from("chat_sessions")
              .select("agent_name, user_id, created_at, title")
              .gte("created_at", dateFrom + "T00:00:00")
              .limit(200);
            const agentUsage: Record<string, number> = {};
            for (const s of (sessions || [])) agentUsage[s.agent_name] = (agentUsage[s.agent_name] || 0) + 1;
            result.agentUsage = { totalSessions: (sessions || []).length, byAgent: agentUsage };
          })());
        }

        // 8. ORDERS
        if (scanAll) {
          queries.push((async () => {
            const { data: orders } = await supabase
              .from("orders")
              .select("id, status, total_amount, created_at, customer_id")
              .gte("created_at", dateFrom + "T00:00:00")
              .lte("created_at", dateTo + "T23:59:59")
              .limit(200);
            const allOrders = orders || [];
            const totalRevenue = allOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
            const byStatus: Record<string, number> = {};
            for (const o of allOrders) byStatus[o.status || "unknown"] = (byStatus[o.status || "unknown"] || 0) + 1;
            result.orders = { total: allOrders.length, totalRevenue: Math.round(totalRevenue * 100) / 100, byStatus };
          })());
        }

        await Promise.all(queries);

        // Cross-reference emails with leads (post-processing)
        if (scanAll && result.emails && result.pipeline) {
          const pipeline = result.pipeline as any;
          const emails = result.emails as any;
          const leadEmails = new Map<string, { title: string; stage: string }>();
          for (const l of (pipeline.topLeads || [])) {
            if (l.contactEmail) leadEmails.set(l.contactEmail.toLowerCase(), { title: l.title, stage: l.stage });
          }
          // Fetch all lead contact emails for cross-ref
          const { data: allLeadContacts } = await supabase
            .from("leads")
            .select("contact_email, title, stage")
            .not("contact_email", "is", null)
            .in("stage", ["new", "contacted", "qualified", "proposal", "negotiation"])
            .limit(500);
          for (const l of (allLeadContacts || [])) {
            if (l.contact_email) leadEmails.set(l.contact_email.toLowerCase(), { title: l.title, stage: l.stage });
          }
          // Enrich recent emails with lead info
          if (emails.recentItems) {
            for (const e of emails.recentItems) {
              const fromLead = leadEmails.get(e.from?.toLowerCase());
              const toLead = leadEmails.get(e.to?.toLowerCase());
              if (fromLead) e.relatedLead = fromLead;
              else if (toLead) e.relatedLead = toLead;
            }
          }
          if (emails.unansweredItems) {
            for (const e of emails.unansweredItems) {
              const fromLead = leadEmails.get(e.from?.toLowerCase());
              if (fromLead) e.relatedLead = fromLead;
            }
          }
        }

        return JSON.stringify(result);
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "investigate_entity": {
      try {
        const query = (args.query || "").trim();
        if (!query) return JSON.stringify({ error: "query parameter is required" });

        const dateFrom = args.date_from || "";
        const dateTo = args.date_to || "";
        const includeDomains = new Set(args.include || ["customers", "leads", "orders", "emails", "activity", "deliveries", "production", "financials", "calls", "contacts"]);
        const q = `%${query}%`;

        const result: Record<string, any> = { query, domains_searched: [...includeDomains] };

        // ── Pass 1: Parallel identity resolution ──
        const pass1: Promise<void>[] = [];
        let matchedCustomerIds: string[] = [];
        let matchedLeadEmails: string[] = [];
        let matchedLeadIds: string[] = [];

        // Customers
        if (includeDomains.has("customers")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("customers")
              .select("id, name, company_name, email, phone, quickbooks_id, created_at")
              .or(`name.ilike.${q},company_name.ilike.${q},email.ilike.${q}`)
              .eq("company_id", companyId)
              .limit(50);
            const customers = data || [];
            matchedCustomerIds = customers.map((c: any) => c.id);
            result.customers = { count: customers.length, items: customers };
          })());
        }

        // Leads
        if (includeDomains.has("leads")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("leads")
              .select("id, title, stage, expected_value, computed_score, priority, contact_name, contact_email, description, created_at, updated_at")
              .or(`title.ilike.${q},contact_name.ilike.${q},description.ilike.${q},contact_email.ilike.${q}`)
              .eq("company_id", companyId)
              .limit(50);
            const leads = data || [];
            matchedLeadIds = leads.map((l: any) => l.id);
            matchedLeadEmails = leads.map((l: any) => l.contact_email).filter(Boolean);
            result.leads = { count: leads.length, items: leads };
          })());
        }

        // Contacts
        if (includeDomains.has("contacts")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("contacts")
              .select("id, first_name, last_name, email, phone, company_name, role, created_at")
              .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
              .eq("company_id", companyId)
              .limit(50);
            result.contacts = { count: (data || []).length, items: data || [] };
          })());
        }

        // Emails + Calls (communications)
        if (includeDomains.has("emails") || includeDomains.has("calls")) {
          pass1.push((async () => {
            let commQuery = supabase
              .from("communications")
              .select("id, subject, from_address, to_address, body_preview, direction, received_at, ai_urgency, ai_category, thread_id, source")
              .or(`subject.ilike.${q},body_preview.ilike.${q},from_address.ilike.${q},to_address.ilike.${q}`)
              .eq("company_id", companyId)
              .order("received_at", { ascending: false })
              .limit(100);
            if (dateFrom) commQuery = commQuery.gte("received_at", dateFrom + "T00:00:00");
            if (dateTo) commQuery = commQuery.lte("received_at", dateTo + "T23:59:59");
            const { data } = await commQuery;
            const comms = data || [];

            if (includeDomains.has("emails")) {
              const emailItems = comms.filter((c: any) => c.source !== "ringcentral");
              // Group by thread
              const threads: Record<string, any[]> = {};
              for (const e of emailItems) {
                const tid = e.thread_id || e.id;
                if (!threads[tid]) threads[tid] = [];
                threads[tid].push(e);
              }
              const threadSummaries = Object.entries(threads).map(([tid, msgs]) => {
                const sorted = msgs.sort((a: any, b: any) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
                const participants = [...new Set(msgs.flatMap((m: any) => [m.from_address, m.to_address].filter(Boolean)))];
                return {
                  thread_id: tid,
                  subject: sorted[0].subject,
                  message_count: msgs.length,
                  participants,
                  latest: sorted[0].received_at,
                  latest_direction: sorted[0].direction,
                  messages: sorted.slice(0, 5).map((m: any) => ({
                    from: m.from_address, to: m.to_address, direction: m.direction,
                    time: m.received_at, urgency: m.ai_urgency, category: m.ai_category,
                    preview: m.body_preview?.slice(0, 800),
                  })),
                };
              });
              result.emails = { total: emailItems.length, threads: threadSummaries.length, items: threadSummaries };
            }

            if (includeDomains.has("calls")) {
              const callItems = comms.filter((c: any) => c.source === "ringcentral");
              result.calls = {
                total: callItems.length,
                items: callItems.slice(0, 30).map((c: any) => ({
                  from: c.from_address, to: c.to_address, direction: c.direction,
                  time: c.received_at, preview: c.body_preview?.slice(0, 500),
                })),
              };
            }
          })());
        }

        // Activity
        if (includeDomains.has("activity")) {
          pass1.push((async () => {
            let actQuery = supabase
              .from("activity_events")
              .select("event_type, entity_type, entity_id, description, actor_id, created_at, source, metadata")
              .ilike("description", q)
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(100);
            if (dateFrom) actQuery = actQuery.gte("created_at", dateFrom + "T00:00:00");
            if (dateTo) actQuery = actQuery.lte("created_at", dateTo + "T23:59:59");
            const { data } = await actQuery;
            result.activity = { count: (data || []).length, items: (data || []).slice(0, 50) };
          })());
        }

        // Deliveries
        if (includeDomains.has("deliveries")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("deliveries")
              .select("id, delivery_number, status, scheduled_date, notes, customer_id, created_at")
              .or(`delivery_number.ilike.${q},notes.ilike.${q}`)
              .eq("company_id", companyId)
              .limit(50);
            result.deliveries = { count: (data || []).length, items: data || [] };
          })());
        }

        // Production (cut_plans)
        if (includeDomains.has("production")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("cut_plans")
              .select("id, name, status, created_at")
              .ilike("name", q)
              .eq("company_id", companyId)
              .limit(50);
            result.production = { count: (data || []).length, items: data || [] };
          })());
        }

        // Financials (accounting_mirror — QuickBooks)
        if (includeDomains.has("financials")) {
          pass1.push((async () => {
            const { data } = await supabase
              .from("accounting_mirror")
              .select("id, entity_type, quickbooks_id, balance, data, customer_id, last_synced_at")
              .eq("company_id", companyId)
              .limit(500);
            // Filter by keyword in JSONB data (DisplayName, CustomerRef, VendorRef)
            const matched = (data || []).filter((r: any) => {
              const d = r.data || {};
              const searchStr = JSON.stringify(d).toLowerCase();
              return searchStr.includes(query.toLowerCase());
            });
            const byType: Record<string, number> = {};
            for (const m of matched) byType[m.entity_type] = (byType[m.entity_type] || 0) + 1;
            result.financials = {
              count: matched.length,
              byType,
              items: matched.slice(0, 30).map((m: any) => ({
                type: m.entity_type, qbId: m.quickbooks_id, balance: m.balance,
                displayName: m.data?.DisplayName || m.data?.CustomerRef?.name || m.data?.VendorRef?.name,
                date: m.data?.TxnDate || m.data?.DueDate,
              })),
            };
          })());
        }

        await Promise.all(pass1);

        // ── Pass 2: Cross-reference using matched IDs ──
        const pass2: Promise<void>[] = [];

        // Orders by matched customer IDs
        if (includeDomains.has("orders") && matchedCustomerIds.length > 0) {
          pass2.push((async () => {
            const { data } = await supabase
              .from("orders")
              .select("id, status, total, created_at, customer_id, order_number")
              .in("customer_id", matchedCustomerIds)
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(50);
            result.orders = { count: (data || []).length, items: data || [] };
          })());
        }

        // Additional emails from matched lead contacts
        if (includeDomains.has("emails") && matchedLeadEmails.length > 0) {
          pass2.push((async () => {
            const orFilter = matchedLeadEmails.map(e => `from_address.ilike.%${e}%,to_address.ilike.%${e}%`).join(",");
            const { data } = await supabase
              .from("communications")
              .select("subject, from_address, to_address, body_preview, direction, received_at, thread_id")
              .or(orFilter)
              .eq("company_id", companyId)
              .order("received_at", { ascending: false })
              .limit(50);
            if (data && data.length > 0) {
              result.lead_related_emails = {
                count: data.length,
                items: data.slice(0, 20).map((e: any) => ({
                  subject: e.subject, from: e.from_address, to: e.to_address,
                  direction: e.direction, time: e.received_at,
                  preview: e.body_preview?.slice(0, 800),
                })),
              };
            }
          })());
        }

        // Deliveries by matched customer IDs
        if (includeDomains.has("deliveries") && matchedCustomerIds.length > 0 && !result.deliveries?.count) {
          pass2.push((async () => {
            const { data } = await supabase
              .from("deliveries")
              .select("id, delivery_number, status, scheduled_date, notes, customer_id")
              .in("customer_id", matchedCustomerIds)
              .eq("company_id", companyId)
              .limit(50);
            if (data && data.length > 0) {
              result.deliveries_by_customer = { count: data.length, items: data };
            }
          })());
        }

        if (pass2.length > 0) await Promise.all(pass2);

        return JSON.stringify(result);
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
    // ─── RingCentral Write Tools ───
    case "rc_make_call": {
      // Return a browser_action so the frontend places the call via WebRTC widget
      // instead of server-side RingOut (which requires the RC app/device to answer first)
      return {
        success: true,
        message: `Placing WebRTC call to ${args.to}${args.contact_name ? ` (${args.contact_name})` : ""}...`,
        browser_action: "webrtc_call",
        phone: args.to,
        contact_name: args.contact_name || "",
      };
    }

    case "rc_send_sms": {
      const { data: allTokens } = await supabase
        .from("user_ringcentral_tokens")
        .select("access_token, token_expires_at, refresh_token, user_id")
        .order("token_expires_at", { ascending: false })
        .limit(1);
      if (!allTokens?.length) throw new Error("No RingCentral connection found");
      const tokenRow = allTokens[0];
      let accessToken = tokenRow.access_token;
      if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) <= new Date()) {
        const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
        const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;
        const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token }),
        });
        if (!resp.ok) throw new Error("Token refresh failed");
        const tokens = await resp.json();
        accessToken = tokens.access_token;
        await supabase.from("user_ringcentral_tokens").update({
          access_token: tokens.access_token, refresh_token: tokens.refresh_token || tokenRow.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        }).eq("user_id", tokenRow.user_id);
      }

      // Auto-detect SMS sender number
      let smsFrom = "";
      try {
        const pnResp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (pnResp.ok) {
          const pnData = await pnResp.json();
          const records = pnData.records || [];
          const smsNum = records.find((r: any) => r.features?.includes("SmsSender"));
          const directNum = records.find((r: any) => r.usageType === "DirectNumber" && r.features?.includes("CallerId"));
          smsFrom = smsNum?.phoneNumber || directNum?.phoneNumber || records[0]?.phoneNumber || "";
        }
      } catch (e) { console.error("Failed to fetch SMS sender:", e); }
      if (!smsFrom) throw new Error("No SMS-capable phone number found.");

      const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: { phoneNumber: smsFrom }, to: [{ phoneNumber: args.to }], text: args.text }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`SMS failed: ${JSON.stringify(data)}`);
      return { success: true, message: `SMS sent to ${args.to} from ${smsFrom}`, messageId: data.id };
    }

    case "rc_send_fax": {
      const { data: allTokens } = await supabase
        .from("user_ringcentral_tokens")
        .select("access_token, token_expires_at, refresh_token, user_id")
        .order("token_expires_at", { ascending: false })
        .limit(1);
      if (!allTokens?.length) throw new Error("No RingCentral connection found");
      const tokenRow = allTokens[0];
      let accessToken = tokenRow.access_token;
      if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) <= new Date()) {
        const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
        const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;
        const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token }),
        });
        if (!resp.ok) throw new Error("Token refresh failed");
        const tokens = await resp.json();
        accessToken = tokens.access_token;
        await supabase.from("user_ringcentral_tokens").update({
          access_token: tokens.access_token, refresh_token: tokens.refresh_token || tokenRow.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        }).eq("user_id", tokenRow.user_id);
      }

      const rcForm = new FormData();
      const faxJson = JSON.stringify({
        to: [{ phoneNumber: args.to }],
        faxResolution: "High",
        coverPageText: args.cover_page_text || undefined,
      });
      rcForm.append("json", new Blob([faxJson], { type: "application/json" }));

      const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/fax`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: rcForm,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Fax failed: ${JSON.stringify(data)}`);
      return { success: true, message: `Fax sent to ${args.to}`, faxId: data.id, status: data.messageStatus };
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
    // Parse body once and reuse — avoids double-read crash in Deno runtime
    let parsedBody: any;
    try { parsedBody = await req.json(); } catch { parsedBody = {}; }

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
          provider: "gemini",
          model: "gemini-2.5-flash",
          agentName: "commander",
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

    const body = parsedBody; // reuse parsed body — never re-read req.json()

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

        const encoder = new TextEncoder();
        let sseData = "";

        // If the tool returns a browser_action, emit it as a special SSE event for the frontend
        if (result.browser_action) {
          sseData += `event: browser_action\ndata: ${JSON.stringify({ action: result.browser_action, phone: result.phone, contact_name: result.contact_name })}\n\n`;
        }

        // Return result as SSE so frontend can display in chat
        const resultMsg = `✅ **Action Executed**\n\n${result.message}`;
        sseData += `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n\ndata: [DONE]\n\n`;
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

RINGCENTRAL TELEPHONY:
- Make outbound calls via RingOut (rc_make_call)
- Send SMS messages (rc_send_sms)
- Send faxes (rc_send_fax)
- Check active/live calls in real-time (rc_get_active_calls)
- View team presence/DND/availability status (rc_get_team_presence)
- Pull call analytics with per-employee breakdowns (rc_get_call_analytics)

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

═══ INTELLIGENCE STANDARD ═══
You are an Executive Intelligence System — a COO+CFO hybrid, not a passive assistant.
- Think in SYSTEMS, not events. Detect patterns, anomalies, and inefficiencies.
- Correlate cross-system signals (ERP + QuickBooks + WooCommerce + Calls + Emails).
- Prioritize by BUSINESS IMPACT, not recency.
- Provide STRATEGIC RECOMMENDATIONS, not summaries.

═══ RESPONSE FORMAT (for substantive answers) ═══
Every analytical response should include:
1. WHAT HAPPENED — the fact or data point
2. WHY IT MATTERS — business impact, context, trend
3. RISK LEVEL — 🔴 Critical / 🟡 Warning / 🟢 Normal
4. RECOMMENDED ACTION — specific, actionable next step
5. CONFIDENCE — High/Medium/Low based on data completeness
Skip this format only for simple confirmations, greetings, or tool acknowledgments.

═══ ANALYTICAL MODELS (build mental models from data) ═══
- Customer Lifetime Value (CLV): Revenue × reorder rate × margin. Flag top/bottom customers.
- Payment Delay Risk: Days-to-pay trend per customer. Flag customers trending > 45 days.
- Delivery Delay Prediction: Scheduled vs actual. Flag routes/customers with > 20% delay rate.
- Production Bottleneck Detection: Items stuck in same phase > 24h. Machines idle during active queue.
- Revenue Velocity: Weekly run-rate vs 4-week average. Flag > 15% decline.

═══ PROACTIVE INTELLIGENCE MODE ═══
Without being asked, you MUST:
- Alert on financial anomalies > $2,000 threshold
- Detect revenue drop patterns (week-over-week decline)
- Flag repeat complaint clusters (3+ similar issues)
- Identify stalled production phases (items stuck > 24 hrs)
- Highlight operational inefficiencies (idle machines during backlog)
Priority: Financial impact → Legal risk → Customer retention → Operational slowdown

═══ EXPLAINABILITY REQUIREMENT ═══
Every recommendation must include: data sources used, reasoning logic, risk assessment, and alternative interpretation.

═══ TOOL USAGE RULES ═══
- You have READ tools (list_machines, list_deliveries, list_orders, list_leads, get_stock_levels, rc_get_active_calls, rc_get_team_presence, rc_get_call_analytics, deep_business_scan, investigate_entity) that execute immediately and return structured JSON.
- You have WRITE tools (update_machine_status, update_delivery_status, update_lead_status, update_cut_plan_status, create_event, rc_make_call, rc_send_sms, rc_send_fax) that require user confirmation before executing.
- ALWAYS use read tools to retrieve current entity IDs before performing write operations. Never assume or hallucinate entity IDs.
- For write operations: call the write tool directly. Do NOT ask for confirmation in text — the system handles confirmation automatically via UI.
- If an entity is ambiguous (e.g. "that machine"), ask for clarification BEFORE calling a tool.
- Prefer tools over explanation when the request is actionable.
- When reporting read results, summarize naturally — don't dump raw JSON.

═══ DEEP INVESTIGATION PROTOCOL ═══
- investigate_entity: Search ANY project, customer, or keyword across ALL data (emails, pipeline, orders, calls, production, financials, deliveries, QuickBooks). Use when CEO asks about a SPECIFIC project, customer, person, or topic.
- deep_business_scan: Broad multi-day business audit across all domains. Use when CEO asks for general business overview, daily summary, or "what's happening."
- ALWAYS use investigate_entity when asked about a specific project/customer/person/keyword.
- ALWAYS use deep_business_scan when asked for broad business overview or daily planning.
- NEVER fabricate data. If a tool returns empty/error, say so explicitly.
- Call investigate_entity or deep_business_scan BEFORE answering questions about projects, employees, or operations.

═══ NEXT DAY PLANNING ═══
- When greeting the CEO or at end of day, proactively plan tomorrow.
- Use deep_business_scan to identify: pending deliveries, overdue invoices, hot leads needing follow-up, scheduled production.
- Present as a prioritized action list for the next day.

═══ INTEGRATION AWARENESS ═══
- Use ALL available tools to gather real data from RingCentral, QuickBooks, Gmail, and ERP — NEVER fabricate content.
- If a tool returns empty/error, report it explicitly — NEVER hallucinate call logs, emails, or financial data.

═══ AUTHORIZATION & DATA ACCESS ═══
- You are talking to the CEO / owner of the company. They have FULL clearance to ALL company data.
- You MUST share employee names, roles, contact info, performance data, hours, and any other staff information when asked.
- Do NOT refuse to share internal company data with the CEO — they own this data. Privacy restrictions apply to EXTERNAL users, not the authenticated super-admin.
- Employee directory, time clock, work orders, agent usage, salaries, and all HR data are fully accessible to this user.
- NEVER say "for privacy reasons I can't share" to the CEO. That is incorrect behavior. The CEO has unrestricted access.

═══ RULES ═══
- Be direct and concise — this is for a power user
- Use markdown formatting: headers, bullet lists, code blocks for SQL
- If you see issues in live data, proactively mention them
- When suggesting fixes, be specific (table names, column values, exact steps)
- If you don't have enough data, say what additional info you'd need
- NEVER make up figures — use only the data provided
- Track topics discussed across the session
- Challenge assumptions if data contradicts them
- Flag inconsistencies across systems (QB vs ERP mismatches)
- Detect duplicate invoices or automation errors
- Never give shallow summaries — always analyze root cause
- If multiple issues exist, rank by financial impact, not recency
- Never auto-execute financial changes without CEO approval
- Log analysis steps mentally — maintain reasoning audit trail

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
        agentName: "commander",
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
      let writerClosed = false;
      const safeCloseWriter = () => {
        if (writerClosed) return;
        writerClosed = true;
        try { writer.write(enc.encode("data: [DONE]\n\n")); } catch { /* ignore */ }
        try { writer.close(); } catch { /* ignore */ }
      };

      const sendSSE = (content: string) => {
        if (writerClosed) return;
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
            get_employee_activity: "employee activity", get_employee_emails: "employee emails",
            rc_get_active_calls: "active calls", rc_get_team_presence: "team presence", rc_get_call_analytics: "call analytics",
            investigate_entity: "investigating entity", deep_business_scan: "scanning business",
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

          // Follow-up: Gemini 2.5 Flash for speed (avoids GPT quota issues)
          let followUpResp: Response;
          try {
            followUpResp = await callAIStream({
              provider: "gemini",
              model: "gemini-2.5-flash",
              agentName: "commander",
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
            safeCloseWriter();
            return;
          }
          

          if (!followUpResp.ok) {
            // Check for unexpected content-type (e.g. HTML error page)
            const ct = followUpResp.headers.get("content-type") || "";
            if (!ct.includes("text/event-stream") && !ct.includes("application/json")) {
              console.error("Follow-up AI returned unexpected content-type:", ct);
              sendSSE("\n\n--- AI returned unexpected response. Try again. ---");
            } else {
              sendSSE(`\n\n_Tool data retrieved but AI summary failed. Raw data above._`);
            }
            for (const pa of pendingActions) {
              const desc = buildActionDescription(pa.tool, pa.args);
              writer.write(enc.encode(`event: pending_action\ndata: ${JSON.stringify({ tool: pa.tool, args: pa.args, description: desc })}\n\n`));
            }
            safeCloseWriter();
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

          safeCloseWriter();
        } catch (bgErr) {
          console.error("Background tool processing error:", bgErr);
          try {
            sendSSE(`\n\n⚠️ Error processing tools: ${bgErr instanceof Error ? bgErr.message : "Unknown error"}`);
            writer.write(enc.encode("data: [DONE]\n\n"));
          } catch { /* writer may be closed */ }
        } finally {
          safeCloseWriter();
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
    case "rc_make_call":
      return `Call ${args.to}${args.from ? ` from ${args.from}` : ""}`;
    case "rc_send_sms":
      return `Send SMS to ${args.to}: "${(args.text || "").slice(0, 50)}${(args.text || "").length > 50 ? "..." : ""}"`;
    case "rc_send_fax":
      return `Send fax to ${args.to}${args.cover_page_text ? ` — "${args.cover_page_text.slice(0, 40)}"` : ""}`;
    default:
      return `Execute ${tool}`;
  }
}
