import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Smoke test / health check endpoint.
 * Non-destructive checks against core tables and services to verify system health.
 */
Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const admin = ctx.serviceClient;

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

    // --- Wave 1 checks ---
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

    // --- Wave 2 checks ---
    await runCheck("auth_service_available", async () => {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
      if (error) throw error;
      return `auth service ok, ${data.users.length} user(s) sampled`;
    });

    await runCheck("auth_user_shape", async () => {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
      if (error) throw error;
      if (!data.users || data.users.length === 0) return "no users to validate shape";
      const user = data.users[0];
      const requiredKeys = ["id", "email", "created_at"];
      const missing = requiredKeys.filter((k) => !(k in user));
      if (missing.length > 0) throw new Error(`Missing user fields: ${missing.join(", ")}`);
      return `user shape valid: id=${user.id?.substring(0, 8)}…`;
    });

    await runCheck("quote_response_shape", async () => {
      const { data, error } = await admin.from("quotations").select("id, company_id, status, created_at, total_amount").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return "no quotations to validate shape";
      const requiredKeys = ["id", "company_id", "status", "created_at", "total_amount"];
      const missing = requiredKeys.filter((k) => !(k in data));
      if (missing.length > 0) throw new Error(`Missing keys: ${missing.join(", ")}`);
      return "shape valid: id, company_id, status, created_at, total_amount";
    });

    await runCheck("order_response_shape", async () => {
      const { data, error } = await admin.from("orders").select("id, company_id, status").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return "no orders to validate shape";
      const requiredKeys = ["id", "company_id", "status"];
      const missing = requiredKeys.filter((k) => !(k in data));
      if (missing.length > 0) throw new Error(`Missing keys: ${missing.join(", ")}`);
      return "shape valid: id, company_id, status";
    });

    await runCheck("feature_flag_fetch", async () => {
      const { data, error } = await admin.from("feature_flags").select("flag_key, enabled").limit(5);
      if (error) throw error;
      if (!data || !Array.isArray(data)) throw new Error("Expected array response");
      if (data.length > 0 && !("flag_key" in data[0])) throw new Error("Missing flag_key field");
      return `${data.length} flag(s) fetched, shape valid`;
    });

    await runCheck("role_lookup", async () => {
      const { data, error } = await admin.from("user_roles").select("id, user_id, role").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return "no roles to validate";
      if (!("role" in data)) throw new Error("Missing role field");
      return `role lookup ok, sample role: ${data.role}`;
    });

    await runCheck("audit_write_safe", async () => {
      const { data: firstCompany } = await admin.from("companies").select("id").limit(1).maybeSingle();
      if (!firstCompany?.id) return "skipped — no company for probe";
      const probeId = crypto.randomUUID();
      const { error: insertErr } = await admin.from("activity_events").insert({
        id: probeId,
        company_id: firstCompany.id,
        entity_type: "smoke-test-probe",
        entity_id: "probe",
        event_type: "audit",
        description: "Smoke test audit probe — safe to delete",
        source: "smoke-tests",
        metadata: { smoke_test: true, probe: true, purpose: "audit_pipeline_verification" },
      });
      if (insertErr) throw new Error(`Audit insert failed: ${insertErr.message}`);
      await admin.from("activity_events").delete().eq("id", probeId);
      return "audit write + cleanup ok";
    });

    // --- Audit: log smoke test execution ---
    try {
      const { data: firstCompany } = await admin.from("companies").select("id").limit(1).maybeSingle();
      if (firstCompany?.id) {
        await admin.from("activity_events").insert({
          company_id: firstCompany.id,
          entity_type: "system",
          entity_id: "smoke-tests",
          event_type: "audit",
          description: `Smoke test run: ${results.filter(r => r.status === "pass").length}/${results.length} passed`,
          source: "smoke-tests",
          metadata: { smoke_test: true, purpose: "execution_log", checks: results.map(r => ({ check: r.check, status: r.status, ms: r.ms })) },
        });
      }
    } catch (_auditErr) {
      // Best-effort
    }

    const allPassed = results.every((r) => r.status === "pass");

    return new Response(
      JSON.stringify({ healthy: allPassed, checks: results, ts: new Date().toISOString() }),
      { status: allPassed ? 200 : 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }, { functionName: "smoke-tests", authMode: "none", requireCompany: false, wrapResult: false })
);
