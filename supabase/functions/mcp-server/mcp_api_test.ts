import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const MCP_API_KEY = Deno.env.get("MCP_API_KEYV1");
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/mcp-server`;

// Helper: call MCP tool via JSON-RPC
async function callTool(toolName: string, args: Record<string, unknown> = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MCP_API_KEY || "",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

function extractData(body: any): any {
  const content = body?.result?.content?.[0]?.text;
  if (!content) return null;
  try { return JSON.parse(content); } catch { return content; }
}

// ── Auth ──────────────────────────────────────────────────────

Deno.test("401 when no API key provided", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_dashboard_stats", arguments: {} } }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("401 when invalid API key", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "bad-key-12345" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_dashboard_stats", arguments: {} } }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

// ── get_dashboard_stats ──────────────────────────────────────

Deno.test("MCP-001: get_dashboard_stats returns valid counts", async () => {
  if (!MCP_API_KEY) return;
  const { status, body } = await callTool("get_dashboard_stats");
  assertEquals(status, 200);
  const data = extractData(body);
  assertExists(data);
  assertEquals(typeof data.total_customers, "number");
  assertEquals(typeof data.total_leads, "number");
  assertEquals(typeof data.total_machines, "number");
  assertEquals(typeof data.total_cut_plans, "number");
  assertEquals(typeof data.total_deliveries, "number");
  assertEquals(typeof data.total_orders, "number");
  // All counts >= 0
  for (const [key, val] of Object.entries(data)) {
    assertEquals((val as number) >= 0, true, `${key} should be >= 0, got ${val}`);
  }
});

// ── list_customers ───────────────────────────────────────────

Deno.test("MCP-002: list_customers respects limit", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_customers", { limit: 3 });
  const data = extractData(body);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
  assertEquals(data.length <= 3, true, `Expected <= 3 rows, got ${data.length}`);
});

Deno.test("MCP-003: list_customers returns expected fields", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_customers", { limit: 1 });
  const data = extractData(body);
  if (Array.isArray(data) && data.length > 0) {
    const row = data[0];
    assertExists(row.id);
    assertExists(row.name);
    assertEquals(typeof row.id, "string");
  }
});

// ── list_leads ───────────────────────────────────────────────

Deno.test("MCP-004: list_leads with stage filter returns correct stage", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_leads", { stage: "won", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  if (Array.isArray(data)) {
    for (const lead of data) {
      assertEquals(lead.stage, "won", `Lead ${lead.id} has stage ${lead.stage}, expected won`);
    }
  }
});

// ── list_orders ──────────────────────────────────────────────

Deno.test("MCP-005: list_orders returns valid structure", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_orders", { limit: 5 });
  const data = extractData(body);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
  if (data.length > 0) {
    assertExists(data[0].order_number);
    assertExists(data[0].status);
  }
});

Deno.test("MCP-006: list_orders status filter works", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_orders", { status: "confirmed", limit: 10 });
  const data = extractData(body);
  if (Array.isArray(data)) {
    for (const order of data) {
      assertEquals(order.status, "confirmed");
    }
  }
});

// ── list_deliveries ──────────────────────────────────────────

Deno.test("MCP-007: list_deliveries with status=in-transit uses hyphenated format", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_deliveries", { status: "in-transit", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  // Should not error — validates the MCP endpoint accepts hyphenated status
  assertEquals(Array.isArray(data), true);
  for (const d of data) {
    assertEquals(d.status, "in-transit");
  }
});

Deno.test("MCP-008: list_deliveries returns expected fields", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_deliveries", { limit: 1 });
  const data = extractData(body);
  if (Array.isArray(data) && data.length > 0) {
    assertExists(data[0].delivery_number);
    assertExists(data[0].status);
  }
});

// ── list_production_tasks ────────────────────────────────────

Deno.test("MCP-009: list_production_tasks phase filter works", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_production_tasks", { phase: "queued", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  if (Array.isArray(data)) {
    for (const task of data) {
      assertEquals(task.phase, "queued");
    }
  }
});

// ── list_machines ────────────────────────────────────────────

Deno.test("MCP-010: list_machines status filter works", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_machines", { status: "idle", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  if (Array.isArray(data)) {
    for (const m of data) {
      assertEquals(m.status, "idle");
    }
  }
});

Deno.test("MCP-011: list_machines returns machine fields", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_machines", { limit: 1 });
  const data = extractData(body);
  if (Array.isArray(data) && data.length > 0) {
    assertExists(data[0].name);
    assertExists(data[0].status);
  }
});

// ── list_time_entries ────────────────────────────────────────

Deno.test("MCP-012: list_time_entries returns valid structure", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_time_entries", { limit: 5 });
  const data = extractData(body);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
  if (data.length > 0) {
    assertExists(data[0].clock_in);
    assertExists(data[0].profile_id);
  }
});

// ── list_social_posts ────────────────────────────────────────

Deno.test("MCP-013: list_social_posts platform filter works", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_social_posts", { platform: "instagram", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  if (Array.isArray(data)) {
    for (const post of data) {
      assertEquals(post.platform, "instagram");
    }
  }
});

Deno.test("MCP-014: list_social_posts status filter works", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_social_posts", { status: "published", limit: 10 });
  const data = extractData(body);
  assertExists(data);
  if (Array.isArray(data)) {
    for (const post of data) {
      assertEquals(post.status, "published");
    }
  }
});

// ── list_team_channels ───────────────────────────────────────

Deno.test("MCP-015: list_team_channels returns valid structure", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_team_channels", { limit: 5 });
  const data = extractData(body);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

// ── Limit enforcement ────────────────────────────────────────

Deno.test("MCP-016: limit is capped at 50 regardless of input", async () => {
  if (!MCP_API_KEY) return;
  const { body } = await callTool("list_customers", { limit: 999 });
  const data = extractData(body);
  if (Array.isArray(data)) {
    assertEquals(data.length <= 50, true, `Expected <= 50, got ${data.length}`);
  }
});
