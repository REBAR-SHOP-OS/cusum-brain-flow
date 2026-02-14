import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mcpApiKey = Deno.env.get("MCP_API_KEY");

function getDb() {
  return createClient(supabaseUrl, serviceRoleKey);
}

// ── OAuth helpers ───────────────────────────────────────────

// In-memory auth code store (short-lived, edge function lifetime)
const authCodes = new Map<string, { redirectUri: string; expiresAt: number }>();

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", enc.encode(data), key);
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createAccessToken(secret: string): Promise<string> {
  const payload = { sub: "chatgpt", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function verifyAccessToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = await hmacSign(payloadB64, secret);
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

// ── MCP Server ──────────────────────────────────────────────

const mcpServer = new McpServer({
  name: "rebar-erp",
  version: "1.0.0",
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
    "List cut plan items (production tasks). Optional filter: phase (queued, cutting, cut_done, bending, clearance, complete). Returns up to 50 items.",
  inputSchema: {
    type: "object",
    properties: {
      phase: { type: "string", description: "Filter by phase" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ phase, limit }: Record<string, unknown>) => {
    const db = getDb();
    let q = db
      .from("cut_plan_items")
      .select(
        "id, bar_code, cut_length_mm, total_pieces, completed_pieces, phase, bend_type, mark_number, drawing_ref, notes, needs_fix"
      )
      .order("cut_plan_id", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 50));
    if (phase) q = q.eq("phase", phase);
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
      .select("id, order_number, customer_id, status, total_amount, notes, created_at")
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
    "List deliveries. Optional filter: status (scheduled, in_transit, delivered, canceled). Returns up to 50 deliveries.",
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
      .select("id, delivery_number, driver_name, vehicle, scheduled_date, status, notes, created_at")
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

// ── Auth middleware (skip OAuth routes) ─────────────────────

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  // Skip auth for OAuth and well-known endpoints
  if (url.pathname.includes("/oauth/") || url.pathname.includes("/.well-known/")) {
    await next();
    return;
  }
  if (c.req.method === "OPTIONS") return;

  if (!mcpApiKey) {
    return new Response(
      JSON.stringify({ error: "MCP_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("x-api-key");
  const providedKey = apiKeyHeader || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (providedKey === mcpApiKey) {
    await next();
    return;
  }

  if (providedKey && await verifyAccessToken(providedKey, mcpApiKey)) {
    await next();
    return;
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized: invalid API key or token" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ── Catch-all: OAuth + MCP ──────────────────────────────────

app.all("/*", async (c) => {
  const url = new URL(c.req.url);
  const baseUrl = `https://${url.host}/functions/v1/mcp-server`;

  // OAuth Protected Resource Metadata
  if (url.pathname.includes("/.well-known/oauth-protected-resource")) {
    return new Response(JSON.stringify({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      scopes_supported: ["mcp"],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // OAuth Authorization Server Metadata
  if (url.pathname.includes("/.well-known/oauth-authorization-server") || url.pathname.includes("/.well-known/openid-configuration")) {
    return new Response(JSON.stringify({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "client_credentials"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: ["mcp"],
      code_challenge_methods_supported: ["S256"],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // OAuth authorize
  if (url.pathname.includes("/oauth/authorize") && c.req.method === "GET") {
    const redirectUri = c.req.query("redirect_uri");
    const state = c.req.query("state") || "";

    if (!redirectUri) {
      return new Response(JSON.stringify({ error: "redirect_uri required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = crypto.randomUUID();
    authCodes.set(code, { redirectUri, expiresAt: Date.now() + 5 * 60 * 1000 });

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);

    return Response.redirect(target.toString(), 302);
  }

  // OAuth token
  if (url.pathname.includes("/oauth/token") && c.req.method === "POST") {
    const body = await c.req.parseBody();
    const grantType = body.grant_type as string;
    const clientSecret = body.client_secret as string;

    if (!mcpApiKey) {
      return new Response(JSON.stringify({ error: "MCP_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (clientSecret !== mcpApiKey) {
      return new Response(JSON.stringify({ error: "invalid_client" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (grantType === "authorization_code") {
      const code = body.code as string;
      const stored = authCodes.get(code);
      if (!stored || stored.expiresAt < Date.now()) {
        authCodes.delete(code);
        return new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authCodes.delete(code);
    } else if (grantType !== "client_credentials") {
      return new Response(JSON.stringify({ error: "unsupported_grant_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await createAccessToken(mcpApiKey);

    return new Response(JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "mcp",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // MCP handler
  const response = await httpHandler(c.req.raw);
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

Deno.serve(app.fetch);
