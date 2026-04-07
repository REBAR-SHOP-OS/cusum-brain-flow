import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { buildPageContext } from "../_shared/pageMap.ts";
import { WPClient } from "../_shared/wpClient.ts";
import { callAI, callAIStream, AIError } from "../_shared/aiRouter.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

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
  "send_email",
  "create_task",
  "update_task_status",
  "seo_run_audit",
  "seo_run_strategy",
  "teamhub_send_message",
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
  // ─── Email Send Tool ───
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via Gmail on behalf of the CEO. Use when the CEO says 'send', 'email them', or 'send that email'. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body (HTML supported)" },
          threadId: { type: "string", description: "Optional Gmail thread ID to reply in an existing thread" },
          replyToMessageId: { type: "string", description: "Optional Gmail message ID to set In-Reply-To header" },
        },
        required: ["to", "subject", "body"],
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
  // ─── Auto Diagnose & Fix Tool ───
  {
    type: "function",
    function: {
      name: "auto_diagnose_fix",
      description: "Diagnose a system bug using AI analysis. Generates root cause analysis, suggested code fix, and affected files. Use when CEO reports a bug, error, or broken feature.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short bug title" },
          description: { type: "string", description: "What's happening — symptoms, error messages, context" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "How urgent" },
        },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  // ─── Web Research Tool ───
  {
    type: "function",
    function: {
      name: "web_research",
      description: "Search the web for industry news, best practices, technical solutions, competitor intelligence, or any external information. Use proactively when investigating problems, suggesting improvements, or when the CEO asks about trends/news. Returns summarized web results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query — be specific for best results (e.g. 'Core Web Vitals optimization WordPress 2026' or 'rebar industry trends Canada')" },
          limit: { type: "number", description: "Number of results (1-10, default 5)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  // Task management tools
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Query the tasks table. Filter by assigned team member, status, priority, or due date. Returns task details including assignee name and customer name.",
      parameters: {
        type: "object",
        properties: {
          assigned_to_name: { type: "string", description: "Partial name match for the assigned team member (e.g. 'Neel', 'Radin')" },
          status: { type: "string", enum: ["open", "in_progress", "completed", "cancelled"], description: "Filter by task status" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Filter by priority" },
          date: { type: "string", description: "Filter by due_date (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max results (default 30, max 100)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task. Requires CEO approval. Resolve team member names and customer names automatically.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description/details" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority (default: medium)" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          assigned_to_name: { type: "string", description: "Name of team member to assign to (partial match)" },
          customer_name: { type: "string", description: "Customer/company name to link (partial match)" },
          agent_type: { type: "string", enum: ["sales", "accounting", "support", "estimating"], description: "Agent type (default: sales)" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task_status",
      description: "Update a task's status, priority, or resolution note. Requires CEO approval.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "The task UUID to update" },
          status: { type: "string", enum: ["open", "in_progress", "completed", "cancelled"], description: "New status" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "New priority" },
          resolution_note: { type: "string", description: "Note about the resolution" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  // ─── SEO Tools ───
  {
    type: "function",
    function: {
      name: "seo_get_overview",
      description: "Get SEO domain health: keyword count, average position, traffic trends, top pages, task summary. Use when CEO asks about SEO performance.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "seo_list_keywords",
      description: "Query tracked SEO keywords with filters. Returns keyword, position, volume, CTR, impressions, trend, opportunity score.",
      parameters: {
        type: "object",
        properties: {
          min_position: { type: "number", description: "Minimum avg_position (e.g. 1)" },
          max_position: { type: "number", description: "Maximum avg_position (e.g. 10 for page 1)" },
          min_volume: { type: "number", description: "Minimum search volume" },
          trend: { type: "string", enum: ["rising", "falling"], description: "Filter by trend direction" },
          limit: { type: "number", description: "Max results (default 20, max 100)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seo_list_tasks",
      description: "Query SEO tasks by status, priority, or type. Returns actionable SEO recommendations.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "in_progress", "completed", "dismissed"], description: "Filter by status" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Filter by priority" },
          task_type: { type: "string", enum: ["content", "technical", "internal_link", "local", "ai_visibility"], description: "Filter by type" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seo_run_audit",
      description: "Trigger an AI-powered SEO audit. Types: 'analyze' (full site analysis), 'local' (local SEO audit), 'ai-visibility' (AI platform visibility). Requires CEO approval.",
      parameters: {
        type: "object",
        properties: {
          audit_type: { type: "string", enum: ["analyze", "local", "ai-visibility"], description: "Type of audit to run" },
        },
        required: ["audit_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seo_run_strategy",
      description: "Generate AI strategic SEO tasks based on current keyword and page data. Creates 5-10 high-impact tasks. Requires CEO approval.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  // ─── Team Hub Tools ───
  {
    type: "function",
    function: {
      name: "teamhub_send_message",
      description: "Send a message to a Team Hub channel or group on behalf of the CEO. Requires CEO approval. Resolves channel by name.",
      parameters: {
        type: "object",
        properties: {
          channel_name: { type: "string", description: "Channel or group name (e.g. 'Official Channel', 'Official Group')" },
          message: { type: "string", description: "Message content to send" },
        },
        required: ["channel_name", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "teamhub_list_messages",
      description: "Read recent messages from a Team Hub channel or group. Returns messages with sender names and timestamps.",
      parameters: {
        type: "object",
        properties: {
          channel_name: { type: "string", description: "Channel or group name" },
          limit: { type: "number", description: "Max messages to return (default 20)" },
        },
        required: ["channel_name"],
        additionalProperties: false,
      },
    },
  },
  // ─── QuickBooks Financial Tools ───
  {
    type: "function",
    function: {
      name: "fetch_qb_report",
      description: "Fetch a live financial report from QuickBooks: ProfitAndLoss, BalanceSheet, AgedReceivables, AgedPayables, CashFlow, or TaxSummary. Use when the user asks for P&L, balance sheet, AR aging, AP aging, cash flow, or HST/GST summary.",
      parameters: {
        type: "object",
        properties: {
          report_type: {
            type: "string",
            enum: ["ProfitAndLoss", "BalanceSheet", "AgedReceivables", "AgedPayables", "CashFlow", "TaxSummary"],
            description: "Type of report to fetch from QuickBooks",
          },
          start_date: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
          end_date: { type: "string", description: "End date YYYY-MM-DD (optional)" },
          period: { type: "string", description: "e.g. 'This Month', 'Last Month', 'This Year', 'Last Year'" },
        },
        required: ["report_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_gl_anomalies",
      description: "Scan the general ledger for anomalies: round-number entries, unbalanced lines, unusual accounts, or large transactions. Use for audit and financial review.",
      parameters: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "How many days back to scan (default 30)" },
          min_amount: { type: "number", description: "Minimum transaction amount to flag (default 1000)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_qb_sync",
      description: "Trigger an incremental QuickBooks sync to pull the latest invoices, payments, and bills. Use when the user says data looks stale or asks to refresh QB data.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["incremental", "full"], description: "Sync mode (default: incremental)" },
        },
        required: [],
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

async function executeReadTool(supabase: any, toolName: string, args: any, companyId?: string, userId?: string): Promise<string> {
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

    case "auto_diagnose_fix": {
      try {
        const title = args.title || "Unknown issue";
        const description = args.description || "";
        const severity = args.severity || "medium";

        const diagnosisPrompt = `You are a senior full-stack developer and debugging expert analyzing bug reports for a production application built with:
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions in Deno, Row Level Security, Storage)
- **State Management:** TanStack React Query + React hooks
- **Routing:** React Router v6

Your job: Analyze the bug report and produce a comprehensive, actionable diagnosis.

## MANDATORY OUTPUT STRUCTURE

**PROBLEM:** Clear one-line summary with impact.
**ROOT CAUSE:** Deep technical analysis of WHY this happens.
**CONTEXT:** Which pages/components/flows are involved.
**FILE/COMPONENT:** Exact file paths and component names.
**FIX:** Step-by-step code changes with actual code snippets.
**TESTING:** How to verify the fix works.
**DO NOT TOUCH:** Files that must NOT be changed.
**SEVERITY:** ${severity}

## Bug Report
**Title:** ${title}
**Description:** ${description}
**Severity:** ${severity}`;

        const aiResult = await callAI({
          provider: "gemini",
          model: "gemini-2.5-pro",
          agentName: "system",
          messages: [
            { role: "system", content: "You are a senior debugging expert. Produce structured, actionable diagnoses." },
            { role: "user", content: diagnosisPrompt },
          ],
          temperature: 0.3,
          maxTokens: 3000,
          fallback: { provider: "gemini", model: "gemini-2.5-flash" },
        });

        const diagnosis = aiResult.content || "No diagnosis generated";

        // Save to vizzy_memory for tracking
        const memoryKey = `auto_fix_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}`;
        await supabase.from("vizzy_memory").insert({
          user_id: "system",
          category: "auto_fix",
          content: JSON.stringify({ title, severity, diagnosis: diagnosis.slice(0, 2000) }),
          company_id: companyId,
        }).then(() => {}).catch(() => {});

        return JSON.stringify({
          tool: "auto_diagnose_fix",
          title,
          severity,
          diagnosis,
          memory_key: memoryKey,
          note: "Diagnosis saved to memory. Share with App Builder to apply fix.",
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "web_research": {
      try {
        const query = args.query;
        if (!query) return JSON.stringify({ error: "query is required" });

        const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
        if (!apiKey) return JSON.stringify({ error: "Web research not available — Firecrawl not configured" });

        const searchLimit = Math.min(args.limit || 5, 10);
        const response = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: searchLimit,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          return JSON.stringify({ error: data.error || `Search failed (${response.status})` });
        }

        const results = (data.data || []).map((r: any) => ({
          title: r.title || "Untitled",
          url: r.url,
          snippet: (r.markdown || r.description || "").slice(0, 500),
        }));

        return JSON.stringify({ tool: "web_research", query, results, count: results.length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "list_tasks": {
      try {
        const queryLimit = Math.min(args.limit || 30, 100);
        let assignedProfileIds: string[] | null = null;

        // Resolve assigned_to_name → profile IDs
        if (args.assigned_to_name) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("company_id", companyId)
            .ilike("full_name", `%${args.assigned_to_name}%`);
          assignedProfileIds = (profiles || []).map((p: any) => p.id);
          if (assignedProfileIds.length === 0) {
            return JSON.stringify({ tool: "list_tasks", tasks: [], note: `No team member found matching "${args.assigned_to_name}"` });
          }
        }

        let query = supabase
          .from("tasks")
          .select("id, title, description, status, priority, due_date, assigned_to, customer_id, source, agent_type, created_at, completed_at, resolution_note")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(queryLimit);

        if (assignedProfileIds) query = query.in("assigned_to", assignedProfileIds);
        if (args.status) query = query.eq("status", args.status);
        if (args.priority) query = query.eq("priority", args.priority);
        if (args.date) query = query.eq("due_date", args.date);

        const { data: tasks, error } = await query;
        if (error) return JSON.stringify({ error: error.message });

        // Resolve profile names and customer names in bulk
        const profileIds = [...new Set((tasks || []).map((t: any) => t.assigned_to).filter(Boolean))];
        const customerIds = [...new Set((tasks || []).map((t: any) => t.customer_id).filter(Boolean))];

        const profileMap: Record<string, string> = {};
        const customerMap: Record<string, string> = {};

        if (profileIds.length) {
          const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
          for (const p of profiles || []) profileMap[p.id] = p.full_name || "Unknown";
        }
        if (customerIds.length) {
          const { data: customers } = await supabase.from("customers").select("id, name, company_name").in("id", customerIds);
          for (const c of customers || []) customerMap[c.id] = c.company_name || c.name || "Unknown";
        }

        const enriched = (tasks || []).map((t: any) => ({
          ...t,
          assigned_to_name: t.assigned_to ? (profileMap[t.assigned_to] || "Unknown") : null,
          customer_name: t.customer_id ? (customerMap[t.customer_id] || "Unknown") : null,
        }));

        return JSON.stringify({ tool: "list_tasks", tasks: enriched, count: enriched.length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    // ─── SEO Read Tools ───
    case "seo_get_overview": {
      try {
        const { data: domains } = await supabase.from("seo_domains").select("*").eq("company_id", companyId).limit(1);
        const domain = domains?.[0];
        if (!domain) return JSON.stringify({ message: "No SEO domain configured for this company" });

        const [kwRes, pageRes, taskRes] = await Promise.all([
          supabase.from("seo_keyword_ai").select("id, keyword, avg_position, impressions_28d, ctr, search_volume, opportunity_score, trend_score").eq("domain_id", domain.id).order("opportunity_score", { ascending: false }).limit(200),
          supabase.from("seo_page_ai").select("id, url, seo_score, title").eq("domain_id", domain.id).order("seo_score", { ascending: true }).limit(50),
          supabase.from("seo_tasks").select("id, status, priority, task_type").eq("domain_id", domain.id),
        ]);

        const keywords = kwRes.data || [];
        const pages = pageRes.data || [];
        const tasks = taskRes.data || [];

        const avgPos = keywords.length > 0 ? Math.round(keywords.reduce((s: number, k: any) => s + (k.avg_position || 0), 0) / keywords.length * 10) / 10 : null;
        const tasksByStatus: Record<string, number> = {};
        for (const t of tasks) tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;

        return JSON.stringify({
          domain: domain.domain, domainId: domain.id,
          totalKeywords: keywords.length,
          avgPosition: avgPos,
          top10Keywords: keywords.filter((k: any) => k.avg_position && k.avg_position <= 10).length,
          topKeywords: keywords.slice(0, 10).map((k: any) => ({ keyword: k.keyword, position: k.avg_position, volume: k.search_volume, impressions: k.impressions_28d, ctr: k.ctr, opportunity: k.opportunity_score })),
          lowScorePages: pages.filter((p: any) => p.seo_score && p.seo_score < 50).slice(0, 10).map((p: any) => ({ url: p.url, score: p.seo_score, title: p.title })),
          tasks: { total: tasks.length, ...tasksByStatus },
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "seo_list_keywords": {
      try {
        const { data: domains } = await supabase.from("seo_domains").select("id").eq("company_id", companyId).limit(1);
        const domainId = domains?.[0]?.id;
        if (!domainId) return JSON.stringify({ message: "No SEO domain configured" });

        const limit = Math.min(args.limit || 20, 100);
        let q = supabase.from("seo_keyword_ai").select("keyword, avg_position, search_volume, impressions_28d, ctr, opportunity_score, trend_score").eq("domain_id", domainId).order("opportunity_score", { ascending: false }).limit(limit);
        if (args.min_position) q = q.gte("avg_position", args.min_position);
        if (args.max_position) q = q.lte("avg_position", args.max_position);
        if (args.min_volume) q = q.gte("search_volume", args.min_volume);
        if (args.trend === "rising") q = q.gt("trend_score", 10);
        if (args.trend === "falling") q = q.lt("trend_score", -10);

        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ keywords: data || [], count: (data || []).length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "seo_list_tasks": {
      try {
        const limit = Math.min(args.limit || 30, 100);
        let q = supabase.from("seo_tasks").select("id, title, description, priority, status, task_type, expected_impact, entity_url, ai_reasoning, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(limit);
        if (args.status) q = q.eq("status", args.status);
        if (args.priority) q = q.eq("priority", args.priority);
        if (args.task_type) q = q.eq("task_type", args.task_type);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ tasks: data || [], count: (data || []).length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    // ─── Team Hub Read Tool ───
    case "teamhub_list_messages": {
      try {
        const channelName = args.channel_name;
        const limit = Math.min(args.limit || 20, 50);
        const { data: channel } = await supabase.from("team_channels").select("id").ilike("name", `%${channelName}%`).limit(1).maybeSingle();
        if (!channel) return JSON.stringify({ error: `No channel found matching "${channelName}"` });

        const { data: messages, error } = await supabase.from("team_messages").select("id, content, created_at, sender_id, attachments").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(limit);
        if (error) return JSON.stringify({ error: error.message });

        // Resolve sender names
        const senderIds = [...new Set((messages || []).map((m: any) => m.sender_id).filter(Boolean))];
        const nameMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
          for (const p of profiles || []) nameMap[p.id] = p.full_name || "Unknown";
        }

        const enriched = (messages || []).reverse().map((m: any) => ({
          sender: nameMap[m.sender_id] || "Unknown",
          content: m.content,
          time: m.created_at,
          hasAttachments: !!(m.attachments && (Array.isArray(m.attachments) ? m.attachments.length > 0 : Object.keys(m.attachments).length > 0)),
        }));

        return JSON.stringify({ channel: channelName, messages: enriched, count: enriched.length });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "fetch_qb_report": {
      try {
        const reportTypeToAction: Record<string, string> = {
          ProfitAndLoss: "get-profit-loss",
          BalanceSheet: "get-balance-sheet",
          AgedReceivables: "get-aged-receivables",
          AgedPayables: "get-aged-payables",
          CashFlow: "get-cash-flow",
          TaxSummary: "get-tax-summary",
        };

        function resolvePeriodDates(period: string): { startDate: string; endDate: string } {
          const now = new Date();
          const y = now.getFullYear();
          const m = now.getMonth();
          const pad = (n: number) => String(n).padStart(2, "0");
          const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          switch (period?.toLowerCase()) {
            case "this month":
              return { startDate: `${y}-${pad(m + 1)}-01`, endDate: fmt(new Date(y, m + 1, 0)) };
            case "last month": {
              const lm = m === 0 ? 11 : m - 1;
              const ly = m === 0 ? y - 1 : y;
              return { startDate: `${ly}-${pad(lm + 1)}-01`, endDate: fmt(new Date(ly, lm + 1, 0)) };
            }
            case "this year":
              return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
            case "last year":
              return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };
            case "this quarter": {
              const q = Math.floor(m / 3);
              return { startDate: `${y}-${pad(q * 3 + 1)}-01`, endDate: fmt(new Date(y, q * 3 + 3, 0)) };
            }
            default:
              return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
          }
        }

        const action = reportTypeToAction[args.report_type] ?? "get-profit-loss";
        let startDate = args.start_date as string | undefined;
        let endDate = args.end_date as string | undefined;
        if ((!startDate || !endDate) && args.period) {
          const resolved = resolvePeriodDates(args.period as string);
          startDate = startDate ?? resolved.startDate;
          endDate = endDate ?? resolved.endDate;
        }

        let qbBody: Record<string, unknown> = { action, company_id: companyId };
        if (["BalanceSheet", "AgedReceivables", "AgedPayables"].includes(args.report_type)) {
          qbBody.asOfDate = endDate ?? new Date().toISOString().split("T")[0];
        } else {
          if (startDate) qbBody.startDate = startDate;
          if (endDate) qbBody.endDate = endDate;
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const reportRes = await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svcKey}`, ...(userId ? { "x-qb-user-id": userId } : {}) },
          body: JSON.stringify(qbBody),
        });

        if (reportRes.ok) {
          const reportData = await reportRes.json();
          return JSON.stringify({ success: true, report_type: args.report_type, data: reportData });
        } else {
          const errStatus = reportRes.status;
          const errText = await reportRes.text();
          let errorType = "unknown_error";
          let userMessage = "QuickBooks report request failed.";
          let retryable = true;
          let needsReconnect = false;

          if (errStatus === 401) {
            errorType = "provider_auth_error";
            userMessage = "QuickBooks rejected the request after a token refresh attempt. This may be transient — retry in a moment. If it persists, reconnection may be needed.";
          } else if (errStatus === 404) {
            errorType = "connection_not_found";
            userMessage = "No active QuickBooks connection found for this company.";
            needsReconnect = true;
            retryable = false;
          } else if (errStatus >= 500) {
            errorType = "provider_server_error";
            userMessage = "QuickBooks servers returned an error. Retry shortly.";
          }

          return JSON.stringify({ success: false, error_type: errorType, user_message: userMessage, retryable, needs_reconnect: needsReconnect, raw_status: errStatus });
        }
      } catch (e: any) { return JSON.stringify({ success: false, error_type: "fetch_exception", user_message: "Failed to reach QuickBooks service. This is likely transient.", retryable: true, needs_reconnect: false }); }
    }

    case "fetch_gl_anomalies": {
      try {
        const daysBack = args.days_back ?? 30;
        const minAmount = args.min_amount ?? 1000;
        const since = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

        const { data: largeEntries } = await supabase
          .from("gl_transactions")
          .select("id, txn_date, description, total_debit, total_credit, source_ref, status")
          .eq("company_id", companyId)
          .gte("txn_date", since)
          .gte("total_debit", minAmount)
          .order("total_debit", { ascending: false })
          .limit(20);

        const { data: unbalanced } = await supabase
          .from("gl_transactions")
          .select("id, txn_date, description, total_debit, total_credit, source_ref")
          .eq("company_id", companyId)
          .gte("txn_date", since)
          .neq("status", "voided")
          .limit(200);

        const imbalanced = (unbalanced || []).filter((t: any) =>
          Math.abs((t.total_debit || 0) - (t.total_credit || 0)) > 0.01
        );
        const roundNumberFlags = (largeEntries || []).filter((t: any) =>
          (t.total_debit || 0) % 1000 === 0
        );

        return JSON.stringify({
          success: true,
          anomalies: {
            large_transactions: largeEntries || [],
            imbalanced_entries: imbalanced.slice(0, 10),
            round_number_flags: roundNumberFlags,
            summary: { large_count: (largeEntries || []).length, imbalanced_count: imbalanced.length, round_number_count: roundNumberFlags.length, scan_period_days: daysBack, min_amount: minAmount },
          },
        });
      } catch (e: any) { return JSON.stringify({ error: e.message }); }
    }

    case "trigger_qb_sync": {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const syncRes = await fetch(`${supabaseUrl}/functions/v1/qb-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svcKey}`, ...(userId ? { "x-qb-user-id": userId } : {}) },
          body: JSON.stringify({ mode: args.mode || "incremental", company_id: companyId }),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          return JSON.stringify({ success: true, message: "QuickBooks sync triggered", ...syncData });
        } else {
          const syncStatus = syncRes.status;
          const syncErrText = await syncRes.text();
          let syncErrorType = "unknown_error";
          let syncUserMessage = "QuickBooks sync request failed.";
          let syncRetryable = true;
          let syncNeedsReconnect = false;

          if (syncStatus === 401) {
            syncErrorType = "provider_auth_error";
            syncUserMessage = "QuickBooks sync auth failed. This may be transient — retry shortly.";
          } else if (syncStatus === 404) {
            syncErrorType = "connection_not_found";
            syncUserMessage = "No active QuickBooks connection found.";
            syncNeedsReconnect = true;
            syncRetryable = false;
          } else if (syncStatus >= 500) {
            syncErrorType = "provider_server_error";
            syncUserMessage = "QuickBooks sync service error. Retry shortly.";
          }

          return JSON.stringify({ success: false, error_type: syncErrorType, user_message: syncUserMessage, retryable: syncRetryable, needs_reconnect: syncNeedsReconnect, raw_status: syncStatus });
        }
      } catch (e: any) { return JSON.stringify({ success: false, error_type: "fetch_exception", user_message: "Failed to reach sync service. This is likely transient.", retryable: true, needs_reconnect: false }); }
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

    // ─── Email Send ───
    case "send_email": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      // Use the user's JWT (passed via userAuthToken) so gmail-send can resolve the user
      const authToken = args._userAuthToken || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: args.to,
          subject: args.subject,
          body: args.body,
          threadId: args.threadId,
          replyToMessageId: args.replyToMessageId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Email send failed: ${data?.error || JSON.stringify(data)}`);
      return { success: true, message: `Email sent to ${args.to}`, messageId: data.messageId || data.id, threadId: data.threadId };
    }

    case "create_task": {
      // Resolve assigned_to_name → profile ID
      let assignedTo: string | null = null;
      if (args.assigned_to_name) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId)
          .ilike("full_name", `%${args.assigned_to_name}%`)
          .limit(1)
          .maybeSingle();
        assignedTo = profile?.id || null;
      }

      // Resolve customer_name → customer ID
      let customerId: string | null = null;
      if (args.customer_name) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("company_id", companyId)
          .or(`name.ilike.%${args.customer_name}%,company_name.ilike.%${args.customer_name}%`)
          .limit(1)
          .maybeSingle();
        customerId = customer?.id || null;
      }

      // Get CEO's profile ID
      const { data: ceoProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: task, error } = await supabase.from("tasks").insert({
        title: args.title,
        description: args.description || null,
        priority: args.priority || "medium",
        due_date: args.due_date || null,
        assigned_to: assignedTo,
        customer_id: customerId,
        agent_type: args.agent_type || "sales",
        source: "vizzy",
        status: "open",
        company_id: companyId,
        created_by_profile_id: ceoProfile?.id || null,
      }).select("id, title").single();

      if (error) throw new Error(error.message);
      return { success: true, message: `Task created: "${task.title}" (${task.id.slice(0, 8)})`, task_id: task.id };
    }

    case "update_task_status": {
      const updateData: Record<string, any> = {};
      if (args.status) {
        updateData.status = args.status;
        if (args.status === "completed") updateData.completed_at = new Date().toISOString();
      }
      if (args.priority) updateData.priority = args.priority;
      if (args.resolution_note) updateData.resolution_note = args.resolution_note;

      if (Object.keys(updateData).length === 0) throw new Error("No fields to update");

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", args.task_id)
        .eq("company_id", companyId);

      if (error) throw new Error(error.message);
      return { success: true, message: `Task ${args.task_id.slice(0, 8)} updated: ${Object.entries(updateData).map(([k, v]) => `${k}=${v}`).join(", ")}` };
    }

    // ─── SEO Write Tools ───
    case "seo_run_audit": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const auditTypeMap: Record<string, string> = {
        "analyze": "seo-ai-analyze",
        "local": "seo-local-audit",
        "ai-visibility": "seo-ai-visibility-audit",
      };
      const fnName = auditTypeMap[args.audit_type];
      if (!fnName) throw new Error(`Unknown audit type: ${args.audit_type}`);

      // Get domain for this company
      const { data: domains } = await supabase.from("seo_domains").select("id, domain").eq("company_id", companyId).limit(1);
      const domain = domains?.[0];
      if (!domain) throw new Error("No SEO domain configured");

      const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domain.id, domain: domain.domain, company_id: companyId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Audit failed (${resp.status})`);
      return { success: true, message: `${args.audit_type} SEO audit completed for ${domain.domain}. ${data.tasksCreated || data.tasks_created || 0} tasks created.`, data };
    }

    case "seo_run_strategy": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { data: domains } = await supabase.from("seo_domains").select("id, domain").eq("company_id", companyId).limit(1);
      const domain = domains?.[0];
      if (!domain) throw new Error("No SEO domain configured");

      const resp = await fetch(`${supabaseUrl}/functions/v1/seo-ai-strategy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domain.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Strategy generation failed (${resp.status})`);
      return { success: true, message: `AI strategy generated for ${domain.domain}. ${data.tasks_created || 0} strategic tasks created.`, data };
    }

    // ─── Team Hub Write Tool ───
    case "teamhub_send_message": {
      const { data: channel } = await supabase.from("team_channels").select("id, name").ilike("name", `%${args.channel_name}%`).limit(1).maybeSingle();
      if (!channel) throw new Error(`No channel found matching "${args.channel_name}"`);

      // Get CEO's profile_id
      const { data: ceoProfile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      if (!ceoProfile) throw new Error("Could not resolve sender profile");

      const { error } = await supabase.from("team_messages").insert({
        channel_id: channel.id,
        sender_id: ceoProfile.id,
        content: args.message,
      });
      if (error) throw new Error(error.message);
      return { success: true, message: `Message sent to "${channel.name}": "${args.message.slice(0, 80)}${args.message.length > 80 ? "..." : ""}"` };
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

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, userId: authedUserId, body: parsedBody, req: originalReq } = ctx;

    // ═══ PUBLIC MODE (unauthenticated visitor chat) ═══
    if (parsedBody.publicMode && !authedUserId) {
      // Rate limit by IP
      const visitorIp = originalReq.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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
          agentName: "admin-chat",
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
    if (!authedUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: authedUserId };

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

    const body = parsedBody; // reuse parsed body
    const authHeader = originalReq.headers.get("Authorization");

    // Get company_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = profileData?.company_id;

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
        // Inject user JWT for tools that need to forward auth (e.g. send_email → gmail-send)
        const userJwt = authHeader?.replace("Bearer ", "") || "";
        if (tool === "send_email") args._userAuthToken = userJwt;
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

    const { VIZZY_CORE_IDENTITY, VIZZY_TOOL_ADDENDUM } = await import("../_shared/vizzyIdentity.ts");
    const systemPrompt = VIZZY_CORE_IDENTITY + "\n\n" + pageContext + "\n\n" + systemContext + "\n\n" + VIZZY_TOOL_ADDENDUM;
    // First call with tools (55s timeout to fail gracefully before edge function limit)
    // Use Gemini Pro for main Vizzy call
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
        agentName: "admin-chat",
        messages: [{ role: "system", content: systemPrompt }, ...buildMultimodalMessages(messages, imageUrls)],
        tools: JARVIS_TOOLS,
        signal: AbortSignal.timeout(55000),
        fallback: { provider: "gemini", model: "gemini-2.5-flash" },
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
            investigate_entity: "investigating entity", deep_business_scan: "scanning business", auto_diagnose_fix: "diagnosing issue",
            list_tasks: "tasks",
            seo_get_overview: "SEO overview", seo_list_keywords: "SEO keywords", seo_list_tasks: "SEO tasks",
            teamhub_list_messages: "team messages",
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
              result = await executeReadTool(supabase, tc.function.name, args, companyId, authedUserId);
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
              agentName: "admin-chat",
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
  }, { functionName: "admin-chat", authMode: "optional", requireCompany: false, wrapResult: false })
);

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
    case "send_email":
      return `Send email to ${args.to}: "${(args.subject || "").slice(0, 50)}${(args.subject || "").length > 50 ? "..." : ""}"`;
    case "create_task":
      return `Create task: "${args.title}"${args.assigned_to_name ? ` → ${args.assigned_to_name}` : ""}${args.priority ? ` [${args.priority}]` : ""}`;
    case "update_task_status":
      return `Update task ${args.task_id?.slice(0, 8) || "?"}${args.status ? ` → ${args.status}` : ""}${args.priority ? ` priority=${args.priority}` : ""}`;
    case "seo_run_audit":
      return `Run ${args.audit_type} SEO audit`;
    case "seo_run_strategy":
      return `Generate AI strategic SEO tasks`;
    case "teamhub_send_message":
      return `Send to Team Hub "${args.channel_name}": "${(args.message || "").slice(0, 50)}${(args.message || "").length > 50 ? "..." : ""}"`;
    default:
      return `Execute ${tool}`;
  }
}
