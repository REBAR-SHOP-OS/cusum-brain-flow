import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/autopilot-engine`;

Deno.test("401 when no Authorization header", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_runs" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("401 when invalid Bearer token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-garbage-token",
    },
    body: JSON.stringify({ action: "list_runs" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("401 when malformed auth header (Basic)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic dXNlcjpwYXNz",
    },
    body: JSON.stringify({ action: "list_runs" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});
