import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mcpApiKey = Deno.env.get("MCP_API_KEYV1");

function getDb() {
  return createClient(supabaseUrl, serviceRoleKey);
}

// ── MCP Server ──────────────────────────────────────────────

const mcpServer = new McpServer({
  name: "rebar-erp",
  version: "1.1.0",
});

// ── Tool: list_social_posts ─────────────────────────────────

mcpServer.tool("list_social_posts", {
  description:
    "List social media posts. Optional filters: status (draft, scheduled, published), platform (instagram, facebook, linkedin, tiktok, youtube). Returns up to 50 posts.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status" },
      platform: { type: "string", description: "Filter by platform" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, platform, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("social_posts")
      .select("id, content, platform, status, scheduled_date, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    if (platform) q = q.eq("platform", platform);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_leads ────────────────────────────────────────

mcpServer.tool("list_leads", {
  description:
    "List pipeline leads. Optional filter: stage (new, contacted, qualified, proposal, won, lost). Returns up to 50 leads.",
  inputSchema: {
    type: "object",
    properties: {
      stage: { type: "string", description: "Filter by stage" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ stage, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("leads")
      .select(
        "id, title, contact_id, stage, probability, expected_value, source, priority, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (stage) q = q.eq("stage", stage);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_customers ────────────────────────────────────

mcpServer.tool("list_customers", {
  description: "List customers. Returns up to 50 customers.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ limit }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("customers")
      .select("id, name, company_name, status, customer_type, payment_terms, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_production_tasks ─────────────────────────────

mcpServer.tool("list_production_tasks", {
  description:
    "List production tasks. Optional filter: status (queued, cutting, cut_done, bending, clearance, complete). Returns order_id, cut_plan_id, and up to 50 items.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by task status" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("production_tasks")
      .select(
        "id, order_id, cut_plan_id, cut_plan_item_id, task_type, bar_code, cut_length_mm, qty_required, qty_completed, status, mark_number, drawing_ref, asa_shape_code, priority, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_machines ─────────────────────────────────────

mcpServer.tool("list_machines", {
  description:
    "List machines and their status. Optional filter: status (idle, running, blocked, down). Returns up to 50 machines.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("machines")
      .select("id, name, model, type, status, company_id, created_at")
      .order("name")
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_orders ───────────────────────────────────────

mcpServer.tool("list_orders", {
  description: "List orders. Optional filter: status. Returns up to 50 orders.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("orders")
      .select("id, order_number, customer_id, status, total_amount, order_kind, delivery_method, due_date, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_deliveries ───────────────────────────────────

mcpServer.tool("list_deliveries", {
  description:
    "List deliveries. Optional filter: status (scheduled, in-transit, delivered, canceled, completed_with_issues). Returns up to 50 deliveries.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("deliveries")
      .select("id, delivery_number, order_id, driver_name, vehicle, scheduled_date, status, notes, created_at")
      .order("scheduled_date", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_time_entries ─────────────────────────────────

mcpServer.tool("list_time_entries", {
  description: "List time clock entries. Returns up to 50 recent entries.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ limit }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out, break_minutes, notes, created_at")
      .order("clock_in", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: get_dashboard_stats ───────────────────────────────

mcpServer.tool("get_dashboard_stats", {
  description:
    "Get summary counts across all major sections: customers, leads, machines, cut plans, deliveries, orders.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const db = getDb();
    const [customers, leads, machines, cutPlans, deliveries, orders] = await Promise.all([
      db.from("customers").select("id", { count: "exact", head: true }),
      db.from("leads").select("id", { count: "exact", head: true }),
      db.from("machines").select("id", { count: "exact", head: true }),
      db.from("cut_plans").select("id", { count: "exact", head: true }),
      db.from("deliveries").select("id", { count: "exact", head: true }),
      db.from("orders").select("id", { count: "exact", head: true }),
    ]);
    const stats = {
      total_customers: customers.count ?? 0,
      total_leads: leads.count ?? 0,
      total_machines: machines.count ?? 0,
      total_cut_plans: cutPlans.count ?? 0,
      total_deliveries: deliveries.count ?? 0,
      total_orders: orders.count ?? 0,
    };
    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
  },
});

// ── Tool: list_team_channels ────────────────────────────────

mcpServer.tool("list_team_channels", {
  description:
    "List team hub channels. Optional filter: channel_type (group, dm). Returns up to 50 channels.",
  inputSchema: {
    type: "object",
    properties: {
      channel_type: { type: "string", description: "Filter by channel_type (group, dm)" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ channel_type, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("team_channels")
      .select("id, name, description, channel_type, created_at")
      .order("created_at", { ascending: true })
      .limit(Math.min(Number(limit) || 50, 50));
    if (channel_type) q = q.eq("channel_type", channel_type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_team_messages ────────────────────────────────

mcpServer.tool("list_team_messages", {
  description:
    "List messages in a team hub channel. Required: channel_id. Returns up to 50 messages with sender, text, translations.",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: { type: "string", description: "Channel ID (required)" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
    required: ["channel_id"],
  },
  handler: async ({ channel_id, limit }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("team_messages")
      .select("id, channel_id, sender_profile_id, original_text, original_language, translations, created_at")
      .eq("channel_id", channel_id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_team_members ─────────────────────────────────

mcpServer.tool("list_team_members", {
  description:
    "List members of a team hub channel. Required: channel_id. Returns profile_id and joined_at.",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: { type: "string", description: "Channel ID (required)" },
    },
    required: ["channel_id"],
  },
  handler: async ({ channel_id }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("team_channel_members")
      .select("profile_id, joined_at")
      .eq("channel_id", channel_id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_invoices ──────────────────────────────────────

mcpServer.tool("list_invoices", {
  description:
    "List invoices from QuickBooks. Optional filter: overdue_only (boolean, filters balance > 0 and DueDate < today). Returns up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      overdue_only: { type: "boolean", description: "Only return overdue invoices" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ overdue_only, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("accounting_mirror")
      .select("quickbooks_id, balance, data, last_synced_at, customer_id")
      .eq("entity_type", "Invoice")
      .order("last_synced_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (overdue_only) {
      q = q.gt("balance", 0);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (overdue_only && Array.isArray(data)) {
      const today = new Date().toISOString().split("T")[0];
      const filtered = data.filter((r: any) => {
        const due = (r.data as any)?.DueDate;
        return due && due < today;
      });
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_bills ────────────────────────────────────────

mcpServer.tool("list_bills", {
  description:
    "List bills (vendor invoices) from QuickBooks. Optional filter: overdue_only. Returns up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      overdue_only: { type: "boolean", description: "Only return overdue bills" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ overdue_only, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("accounting_mirror")
      .select("quickbooks_id, balance, data, last_synced_at")
      .eq("entity_type", "Bill")
      .order("last_synced_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (overdue_only) {
      q = q.gt("balance", 0);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (overdue_only && Array.isArray(data)) {
      const today = new Date().toISOString().split("T")[0];
      const filtered = data.filter((r: any) => {
        const due = (r.data as any)?.DueDate;
        return due && due < today;
      });
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: get_financial_summary ─────────────────────────────

mcpServer.tool("get_financial_summary", {
  description:
    "Get a bird's-eye financial snapshot: total AR, total AP, overdue invoice count, overdue bill count.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const db = getDb();
    const [invoices, bills] = await Promise.all([
      db.from("accounting_mirror").select("balance, data").eq("entity_type", "Invoice"),
      db.from("accounting_mirror").select("balance, data").eq("entity_type", "Bill"),
    ]);
    const today = new Date().toISOString().split("T")[0];
    const totalAR = (invoices.data || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);
    const totalAP = (bills.data || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);
    const overdueInvoices = (invoices.data || []).filter(
      (r: any) => r.balance > 0 && (r.data as any)?.DueDate < today
    ).length;
    const overdueBills = (bills.data || []).filter(
      (r: any) => r.balance > 0 && (r.data as any)?.DueDate < today
    ).length;
    const summary = { total_ar: totalAR, total_ap: totalAP, overdue_invoices: overdueInvoices, overdue_bills: overdueBills };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
});

// ── Tool: list_communications ───────────────────────────────

mcpServer.tool("list_communications", {
  description:
    "List communications (emails, calls). Filters: direction (inbound/outbound), status, ai_category. Returns up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      direction: { type: "string", description: "Filter: inbound or outbound" },
      status: { type: "string", description: "Filter by status" },
      ai_category: { type: "string", description: "Filter by AI category" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ direction, status, ai_category, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("communications")
      .select("id, subject, from_address, to_address, body_preview, ai_urgency, ai_action_required, ai_category, direction, status, received_at")
      .order("received_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (direction) q = q.eq("direction", direction);
    if (status) q = q.eq("status", status);
    if (ai_category) q = q.eq("ai_category", ai_category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_activity_events ──────────────────────────────

mcpServer.tool("list_activity_events", {
  description:
    "List recent activity events. Filters: event_type, entity_type. Returns up to 50 events.",
  inputSchema: {
    type: "object",
    properties: {
      event_type: { type: "string", description: "Filter by event_type" },
      entity_type: { type: "string", description: "Filter by entity_type" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ event_type, entity_type, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("activity_events")
      .select("id, entity_type, entity_id, event_type, description, actor_id, actor_type, source, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (event_type) q = q.eq("event_type", event_type);
    if (entity_type) q = q.eq("entity_type", entity_type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_profiles ─────────────────────────────────────

mcpServer.tool("list_profiles", {
  description:
    "List employee profiles. Returns full_name, title, department, email, phone, is_active, employee_type. Up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ limit }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, title, department, email, phone, is_active, employee_type")
      .order("full_name")
      .limit(Math.min(Number(limit) || 50, 50));
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_knowledge ────────────────────────────────────

mcpServer.tool("list_knowledge", {
  description:
    "List knowledge base articles. Optional filter: category. Returns title, category, content. Up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Filter by category" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ category, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("knowledge")
      .select("id, title, category, content, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_cut_plans ────────────────────────────────────

mcpServer.tool("list_cut_plans", {
  description:
    "List cut plans. Optional filter: status. Returns up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ status, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("cut_plans")
      .select("id, name, status, order_id, company_id, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: list_packing_slips ────────────────────────────────

mcpServer.tool("list_packing_slips", {
  description:
    "List packing slips. Returns delivery_id, items_json, created_at. Up to 50.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ limit }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db
      .from("packing_slips")
      .select("id, delivery_id, items_json, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: update_lead (write) ───────────────────────────────

mcpServer.tool("update_lead", {
  description:
    "Update a lead's stage, priority, expected_value, or notes by ID. Provide the lead id and fields to update.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Lead ID (required)" },
      stage: { type: "string", description: "New stage" },
      priority: { type: "string", description: "New priority" },
      expected_value: { type: "number", description: "New expected value" },
      notes: { type: "string", description: "New notes" },
    },
    required: ["id"],
  },
  handler: async ({ id, stage, priority, expected_value, notes }: Record<string, unknown>) => {
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (stage !== undefined) updates.stage = stage;
    if (priority !== undefined) updates.priority = priority;
    if (expected_value !== undefined) updates.expected_value = expected_value;
    if (notes !== undefined) updates.notes = notes;
    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "No fields to update" }] };
    }
    const { data, error } = await db.from("leads").update(updates).eq("id", id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: update_order_status (write) ───────────────────────

mcpServer.tool("update_order_status", {
  description: "Update an order's status by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Order ID (required)" },
      status: { type: "string", description: "New status (required)" },
    },
    required: ["id", "status"],
  },
  handler: async ({ id, status }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db.from("orders").update({ status }).eq("id", id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: update_delivery_status (write) ────────────────────

mcpServer.tool("update_delivery_status", {
  description: "Update a delivery's status by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Delivery ID (required)" },
      status: { type: "string", description: "New status (required)" },
    },
    required: ["id", "status"],
  },
  handler: async ({ id, status }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db.from("deliveries").update({ status }).eq("id", id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: create_activity_event (write) ─────────────────────

mcpServer.tool("create_activity_event", {
  description:
    "Log an activity event (e.g. actions taken by ChatGPT). Required: company_id, entity_type, entity_id, event_type. Optional: description, source, actor_type.",
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "Company ID (required)" },
      entity_type: { type: "string", description: "Entity type (required)" },
      entity_id: { type: "string", description: "Entity ID (required)" },
      event_type: { type: "string", description: "Event type (required)" },
      description: { type: "string", description: "Event description" },
      source: { type: "string", description: "Source (default: chatgpt)" },
      actor_type: { type: "string", description: "Actor type (default: ai)" },
    },
    required: ["company_id", "entity_type", "entity_id", "event_type"],
  },
  handler: async ({ company_id, entity_type, entity_id, event_type, description, source, actor_type }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db.from("activity_events").insert({
      company_id,
      entity_type,
      entity_id,
      event_type,
      description: description || null,
      source: source || "chatgpt",
      actor_type: actor_type || "ai",
    }).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: send_team_message (write) ─────────────────────────

mcpServer.tool("send_team_message", {
  description:
    "Send a message to a team hub channel. Required: channel_id, sender_profile_id, text.",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: { type: "string", description: "Channel ID (required)" },
      sender_profile_id: { type: "string", description: "Sender profile ID (required)" },
      text: { type: "string", description: "Message text (required)" },
    },
    required: ["channel_id", "sender_profile_id", "text"],
  },
  handler: async ({ channel_id, sender_profile_id, text }: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db.from("team_messages").insert({
      channel_id,
      sender_profile_id,
      original_text: text,
      original_language: "en",
    }).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Helper: proxy to vizzy-erp-action ──────────────────────

async function callErpAction(action: string, params: Record<string, unknown>) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/vizzy-erp-action`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...params }),
  });
  return resp.json();
}

// ── Tool: get_customer ──────────────────────────────────────

mcpServer.tool("get_customer", {
  description: "Get a single ERP customer record by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Customer UUID" },
    },
    required: ["id"],
  },
  handler: async ({ id }: Record<string, unknown>) => {
    const result = await callErpAction("get_customer", { id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Tool: update_customer ───────────────────────────────────

mcpServer.tool("update_customer", {
  description: "Update an ERP customer record. Blocks edits on archived/merged customers except merge metadata. Does NOT sync to external systems.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Customer UUID" },
      payload: { type: "object", description: "Fields to update (e.g. name, phone, billing address)" },
      suppress_external_sync: { type: "boolean", description: "Skip external sync (default true)" },
    },
    required: ["id", "payload"],
  },
  handler: async ({ id, payload, suppress_external_sync }: Record<string, unknown>) => {
    const result = await callErpAction("update_customer", { id, payload, suppress_external_sync });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Tool: list_contacts ─────────────────────────────────────

mcpServer.tool("list_contacts", {
  description: "List contacts for a given customer/company. Supports pagination.",
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "Customer UUID to list contacts for" },
      limit: { type: "number", description: "Max rows (default 50)" },
      offset: { type: "number", description: "Offset for pagination (default 0)" },
    },
    required: ["company_id"],
  },
  handler: async ({ company_id, limit, offset }: Record<string, unknown>) => {
    const result = await callErpAction("list_contacts", { company_id, limit, offset });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Tool: create_contact ────────────────────────────────────

mcpServer.tool("create_contact", {
  description: "Create a new contact under a customer/company. Enforces email/phone dedup within the same company.",
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "Customer UUID to attach contact to" },
      payload: { type: "object", description: "Contact fields: first_name (required), last_name, email, phone, role, is_primary" },
    },
    required: ["company_id", "payload"],
  },
  handler: async ({ company_id, payload }: Record<string, unknown>) => {
    const result = await callErpAction("create_contact", { company_id, payload });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Tool: merge_customers ───────────────────────────────────

mcpServer.tool("merge_customers", {
  description: "Merge duplicate customer records into a primary record. Re-links all ERP relations (orders, projects, leads, etc.), converts person-type duplicates to contacts, and archives duplicates. Use dry_run=true to preview. ERP-only — no external sync.",
  inputSchema: {
    type: "object",
    properties: {
      primary_id: { type: "string", description: "UUID of the primary (surviving) customer" },
      duplicate_ids: { type: "array", items: { type: "string" }, description: "UUIDs of duplicate customers to merge into primary" },
      dry_run: { type: "boolean", description: "If true, returns preview of affected rows without making changes" },
      merge_reason: { type: "string", description: "Reason for the merge (stored in audit trail)" },
      suppress_external_sync: { type: "boolean", description: "Skip external sync (default true)" },
    },
    required: ["primary_id", "duplicate_ids"],
  },
  handler: async ({ primary_id, duplicate_ids, dry_run, merge_reason, suppress_external_sync }: Record<string, unknown>) => {
    const result = await callErpAction("merge_customers", { primary_id, duplicate_ids, dry_run, merge_reason, suppress_external_sync });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Tool: create_customer (write) ───────────────────────────

mcpServer.tool("create_customer", {
  description:
    "Create a new customer record. Required: name, company_id. Optional: company_name, customer_type, phone, email, payment_terms, billing_address, notes.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer name (required)" },
      company_id: { type: "string", description: "Company/tenant ID (required)" },
      company_name: { type: "string", description: "Company name" },
      customer_type: { type: "string", description: "Type: company or individual" },
      phone: { type: "string", description: "Phone number" },
      email: { type: "string", description: "Email address" },
      payment_terms: { type: "string", description: "Payment terms" },
      billing_address: { type: "string", description: "Billing address" },
      notes: { type: "string", description: "Notes" },
    },
    required: ["name", "company_id"],
  },
  handler: async ({ name, company_id, company_name, customer_type, phone, email, payment_terms, billing_address, notes }: Record<string, unknown>) => {
    const db = getDb();
    const row: Record<string, unknown> = {
      name,
      company_id,
      status: "active",
    };
    if (company_name) row.company_name = company_name;
    if (customer_type) row.customer_type = customer_type;
    if (phone) row.phone = phone;
    if (email) row.email = email;
    if (payment_terms) row.payment_terms = payment_terms;
    if (billing_address) row.billing_address = billing_address;
    if (notes) row.notes = notes;

    const { data, error } = await db.from("customers").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    // Log activity
    await db.from("activity_events").insert({
      company_id,
      entity_type: "customer",
      entity_id: data.id,
      event_type: "created",
      description: `Customer "${name}" created via ChatGPT`,
      source: "chatgpt",
      actor_type: "ai",
    });

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: create_quote (write) ──────────────────────────────

mcpServer.tool("create_quote", {
  description:
    "Create a new quote. Auto-generates quote_number. Required: company_id, customer_id. Optional: total_amount, valid_until, notes, metadata (line items object).",
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "Company/tenant ID (required)" },
      customer_id: { type: "string", description: "Customer ID (required)" },
      total_amount: { type: "number", description: "Total amount" },
      valid_until: { type: "string", description: "Expiry date (YYYY-MM-DD)" },
      notes: { type: "string", description: "Notes" },
      metadata: { type: "object", description: "Line items and extra data" },
    },
    required: ["company_id", "customer_id"],
  },
  handler: async ({ company_id, customer_id, total_amount, valid_until, notes, metadata }: Record<string, unknown>) => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    for (let attempt = 0; attempt < 5; attempt++) {
      const { count } = await db
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .like("quote_number", `QT-${today}%`);
      const seq = String((count || 0) + 1 + attempt).padStart(3, "0");
      const quoteNumber = `QT-${today}-${seq}`;

      const row: Record<string, unknown> = {
        quote_number: quoteNumber,
        company_id,
        customer_id,
        status: "draft",
        total_amount: total_amount || 0,
      };
      if (valid_until) row.valid_until = valid_until;
      if (notes) row.notes = notes;
      if (metadata) row.metadata = metadata;

      const { data, error } = await db.from("quotes").insert(row).select().single();
      if (!error) {
        await db.from("activity_events").insert({
          company_id: company_id as string,
          entity_type: "quote",
          entity_id: data.id,
          event_type: "created",
          description: `Quote ${quoteNumber} created via ChatGPT`,
          source: "chatgpt",
          actor_type: "ai",
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (!error.message?.includes("duplicate") && !error.message?.includes("unique")) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
    return { content: [{ type: "text", text: "Error: Failed to generate unique quote number after 5 attempts" }] };
  },
});

// ── Tool: create_order (write) ──────────────────────────────

mcpServer.tool("create_order", {
  description:
    "Create a new order. Auto-generates order_number. Required: company_id, customer_id. Optional: total_amount, status, order_kind, due_date, notes, quote_id.",
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "Company/tenant ID (required)" },
      customer_id: { type: "string", description: "Customer ID (required)" },
      total_amount: { type: "number", description: "Total amount" },
      status: { type: "string", description: "Order status (default: approved)" },
      order_kind: { type: "string", description: "Order kind (default: commercial)" },
      due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
      notes: { type: "string", description: "Notes" },
      quote_id: { type: "string", description: "Linked quote ID" },
    },
    required: ["company_id", "customer_id"],
  },
  handler: async ({ company_id, customer_id, total_amount, status, order_kind, due_date, notes, quote_id }: Record<string, unknown>) => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    for (let attempt = 0; attempt < 5; attempt++) {
      const { count } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .like("order_number", `ORD-${today}%`);
      const seq = String((count || 0) + 1 + attempt).padStart(3, "0");
      const orderNumber = `ORD-${today}-${seq}`;

      const row: Record<string, unknown> = {
        order_number: orderNumber,
        company_id,
        customer_id,
        total_amount: total_amount || 0,
        status: status || "approved",
        order_kind: order_kind || "commercial",
        order_date: new Date().toISOString().slice(0, 10),
      };
      if (due_date) row.due_date = due_date;
      if (notes) row.notes = notes;
      if (quote_id) row.quote_id = quote_id;

      const { data, error } = await db.from("orders").insert(row).select().single();
      if (!error) {
        await db.from("activity_events").insert({
          company_id: company_id as string,
          entity_type: "order",
          entity_id: data.id,
          event_type: "created",
          description: `Order ${orderNumber} created via ChatGPT`,
          source: "chatgpt",
          actor_type: "ai",
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (!error.message?.includes("duplicate") && !error.message?.includes("unique")) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
    return { content: [{ type: "text", text: "Error: Failed to generate unique order number after 5 attempts" }] };
  },
});

// ── Tool: update_order (write) ──────────────────────────────

mcpServer.tool("update_order", {
  description:
    "Update an order's fields by ID. Supports: status, total_amount, due_date, notes, delivery_method.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Order ID (required)" },
      status: { type: "string", description: "New status" },
      total_amount: { type: "number", description: "New total amount" },
      due_date: { type: "string", description: "New due date (YYYY-MM-DD)" },
      notes: { type: "string", description: "New notes" },
      delivery_method: { type: "string", description: "Delivery method" },
    },
    required: ["id"],
  },
  handler: async ({ id, status, total_amount, due_date, notes, delivery_method }: Record<string, unknown>) => {
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (total_amount !== undefined) updates.total_amount = total_amount;
    if (due_date !== undefined) updates.due_date = due_date;
    if (notes !== undefined) updates.notes = notes;
    if (delivery_method !== undefined) updates.delivery_method = delivery_method;
    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "No fields to update" }] };
    }
    const { data, error } = await db.from("orders").update(updates).eq("id", id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data) return { content: [{ type: "text", text: "Error: Order not found" }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── Tool: convert_lead_to_quote (write) ─────────────────────

mcpServer.tool("convert_lead_to_quote", {
  description:
    "Convert a lead into a draft quote. Reads lead data (customer, expected_value) and creates a quote linked to the lead. Required: lead_id, company_id.",
  inputSchema: {
    type: "object",
    properties: {
      lead_id: { type: "string", description: "Lead ID (required)" },
      company_id: { type: "string", description: "Company/tenant ID (required)" },
    },
    required: ["lead_id", "company_id"],
  },
  handler: async ({ lead_id, company_id }: Record<string, unknown>) => {
    const db = getDb();

    // Fetch lead
    const { data: lead, error: lErr } = await db
      .from("leads")
      .select("id, title, contact_id, expected_value, customer_id, notes")
      .eq("id", lead_id)
      .maybeSingle();
    if (lErr || !lead) return { content: [{ type: "text", text: `Error: Lead not found` }] };

    const customerId = lead.customer_id;
    if (!customerId) {
      return { content: [{ type: "text", text: "Error: Lead has no customer_id. Assign a customer before converting." }] };
    }

    // Generate quote number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    for (let attempt = 0; attempt < 5; attempt++) {
      const { count } = await db
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .like("quote_number", `QT-${today}%`);
      const seq = String((count || 0) + 1 + attempt).padStart(3, "0");
      const quoteNumber = `QT-${today}-${seq}`;

      const { data: quote, error: qErr } = await db.from("quotes").insert({
        quote_number: quoteNumber,
        company_id,
        customer_id: customerId,
        lead_id: lead.id,
        status: "draft",
        total_amount: lead.expected_value || 0,
        notes: lead.notes ? `From lead: ${lead.title}\n${lead.notes}` : `From lead: ${lead.title}`,
      }).select().single();

      if (!qErr) {
        // Update lead stage to proposal
        await db.from("leads").update({ stage: "proposal" }).eq("id", lead_id);

        await db.from("activity_events").insert({
          company_id: company_id as string,
          entity_type: "quote",
          entity_id: quote.id,
          event_type: "created",
          description: `Quote ${quoteNumber} created from lead "${lead.title}" via ChatGPT`,
          source: "chatgpt",
          actor_type: "ai",
        });

        return { content: [{ type: "text", text: JSON.stringify({ quote, lead_updated: true }, null, 2) }] };
      }
      if (!qErr.message?.includes("duplicate") && !qErr.message?.includes("unique")) {
        return { content: [{ type: "text", text: `Error: ${qErr.message}` }] };
      }
    }
    return { content: [{ type: "text", text: "Error: Failed to generate unique quote number after 5 attempts" }] };
  },
});

// ── Boot diagnostics ────────────────────────────────────────

const envName = Deno.env.get("ENV") || Deno.env.get("ENVIRONMENT") || Deno.env.get("DENO_DEPLOYMENT_ID") || "unknown";
console.log("MCP BOOT:", { env: envName, baseUrl: supabaseUrl, server: "rebar-erp", version: "1.1.0" });
console.log("MCP TOOLS:", mcpServer.listTools?.() || "no listTools method");

// ── HTTP Transport ──────────────────────────────────────────

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);
const app = new Hono();

// CORS middleware
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  await next();
});

// ── Auth middleware ─────────────────────────────────────────

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return;

  if (!mcpApiKey) {
    return new Response(
      JSON.stringify({ error: "MCP_API_KEYV1 not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check API key from secure headers only
  const apiKeyHeader = c.req.header("x-api-key");
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const providedKey = apiKeyHeader || bearerToken;

  if (providedKey === mcpApiKey) {
    await next();
    return;
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized: invalid API key" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ── MCP handler ─────────────────────────────────────────────

app.all("/*", async (c) => {
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

Deno.serve(app.fetch);
