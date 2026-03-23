import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * Smoke test / health check endpoint.
 * Read-only checks against core tables to verify system health.
 * Returns JSON report with pass/fail + latency per check.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const results: Array<{ check: string; status: "pass" | "fail"; ms: number; detail?: string }> = [];

  async function runCheck(name: string, fn: () => Promise<string | null>) {
    const start = Date.now();
    try {
      const detail = await fn();
      results.push({ check: name, status: "pass", ms: Date.now() - start, detail: detail ?? undefined });
    } catch (err: any) {
      results.push({ check: name, status: "fail", ms: Date.now() - start, detail: err.message });
    }
  }

  await runCheck("db_connectivity", async () => {
    const { count, error } = await admin.from("profiles").select("*", { count: "exact", head: true });
    if (error) throw error;
    return `${count} profiles`;
  });

  await runCheck("company_resolution", async () => {
    const { data, error } = await admin.from("companies").select("id").limit(1).maybeSingle();
    if (error) throw error;
    return data ? "company found" : "no companies";
  });

  await runCheck("quotations_readable", async () => {
    const { count, error } = await admin.from("quotations").select("*", { count: "exact", head: true });
    if (error) throw error;
    return `${count} quotations`;
  });

  await runCheck("orders_readable", async () => {
    const { count, error } = await admin.from("orders").select("*", { count: "exact", head: true });
    if (error) throw error;
    return `${count} orders`;
  });

  await runCheck("feature_flags_readable", async () => {
    const { count, error } = await admin.from("feature_flags").select("*", { count: "exact", head: true });
    if (error) throw error;
    return `${count} flags`;
  });

  const allPassed = results.every((r) => r.status === "pass");

  return new Response(
    JSON.stringify({ healthy: allPassed, checks: results, ts: new Date().toISOString() }),
    { status: allPassed ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
