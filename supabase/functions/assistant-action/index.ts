import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  source: z.literal("erp"),
  action: z.enum(["get_dashboard_stats", "list_machines", "list_production_tasks"]),
  params: z.record(z.unknown()).optional().default({}),
});

/** Proxy an action to vizzy-erp-action (the single ERP connector surface). */
async function callErpAction(
  action: string,
  params: Record<string, unknown>,
  authHeader: string,
): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const resp = await fetch(`${supabaseUrl}/functions/v1/vizzy-erp-action`, {
    method: "POST",
    headers: {
      Authorization: authHeader || `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: JSON.stringify({ action, params }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error || `ERP action failed (${resp.status})`);
  }

  return resp.json();
}

Deno.serve((req) =>
  handleRequest(req, async ({ body, req: rawReq, log }) => {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { action, params } = parsed.data;
    const authHeader = rawReq.headers.get("Authorization") || "";

    const erp = await callErpAction(action, params, authHeader);
    const data = erp.data;

    // Build spoken summary per action
    let spoken = "Done.";
    let cardTitle = "Result";

    if (action === "get_dashboard_stats") {
      cardTitle = "Dashboard Stats";
      spoken = `You have ${data.total_orders ?? 0} orders, ${data.total_customers ?? 0} customers, ${data.total_leads ?? 0} leads, ${data.total_machines ?? 0} machines, and ${data.total_cut_plans ?? 0} cut plans.`;
    }

    if (action === "list_machines") {
      cardTitle = "Machines";
      const count = Array.isArray(data) ? data.length : 0;
      spoken = count === 0
        ? "No machines found."
        : `Found ${count} machine${count > 1 ? "s" : ""}. ${data.slice(0, 3).map((m: any) => m.name).join(", ")}${count > 3 ? " and more" : ""}.`;
    }

    if (action === "list_production_tasks") {
      cardTitle = "Production Tasks";
      const count = Array.isArray(data) ? data.length : 0;
      spoken = count === 0
        ? "No production tasks found."
        : `Found ${count} production task${count > 1 ? "s" : ""}.`;
    }

    log.done("Action proxied", { action, cardTitle });

    return { ok: true, spoken, cardTitle, data };
  }, { functionName: "assistant-action", authMode: "none", requireCompany: false, wrapResult: false }),
);
