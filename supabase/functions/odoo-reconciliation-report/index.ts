import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { STAGE_MAP } from "../_shared/odoo-validation.ts";

async function odooRpc(url: string, db: string, apiKey: string, model: string, method: string, args: unknown[]) {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "call",
      params: { service: "object", method: "execute_kw", args: [db, 2, apiKey, model, method, ...args] },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo RPC error");
  return data.result;
}

interface ComparisonRow {
  odoo_id: string;
  erp_id: string | null;
  status: "MATCH" | "MISSING_IN_ERP" | "OUT_OF_SYNC" | "DUPLICATE";
  diffs: string[];
  action: string;
  odoo_name: string;
  odoo_stage: string;
  erp_stage?: string;
  auto_fixable: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ODOO_ENABLED feature flag guard
  if (Deno.env.get("ODOO_ENABLED") !== "true") {
    return new Response(JSON.stringify({ error: "Odoo integration is disabled", disabled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { serviceClient } = await requireAuth(req);

    // Parse mode: "report" (default) or "fix" (auto-fix OUT_OF_SYNC items)
    let autoFix = false;
    try {
      const body = await req.json();
      if (body?.mode === "fix") autoFix = true;
    } catch { /* no body */ }

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const cutoff = fiveDaysAgo.toISOString().replace("T", " ").slice(0, 19);

    const odooLeads = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
      [[["type", "=", "opportunity"], ["write_date", ">=", cutoff]]],
      { fields: ["id", "name", "stage_id", "probability", "expected_revenue", "partner_name", "date_deadline"] },
    ]);

    // Load all ERP odoo_sync leads
    const erpLeads: Array<{ id: string; metadata: unknown; stage: string; expected_value: number; customer_id: string | null; expected_close_date: string | null }> = [];
    let from = 0;
    while (true) {
      const { data } = await serviceClient
        .from("leads")
        .select("id, metadata, stage, expected_value, customer_id, expected_close_date")
        .eq("source", "odoo_sync")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      erpLeads.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    // Build ERP lookup by odoo_id
    const erpByOdooId = new Map<string, typeof erpLeads>();
    for (const l of erpLeads) {
      const oid = (l.metadata as Record<string, unknown>)?.odoo_id as string;
      if (!oid) continue;
      const arr = erpByOdooId.get(oid) || [];
      arr.push(l);
      erpByOdooId.set(oid, arr);
    }

    const results: ComparisonRow[] = [];
    let matchCount = 0, missingCount = 0, syncCount = 0, dupCount = 0;
    let fixedCount = 0;

    for (const ol of odooLeads) {
      const odooId = String(ol.id);
      const stageName = Array.isArray(ol.stage_id) ? ol.stage_id[1] : String(ol.stage_id || "");
      const expectedErpStage = STAGE_MAP[stageName] || "new";
      const expectedProb = expectedErpStage === "won" ? 100 : expectedErpStage === "lost" ? 0 : Math.round(Number(ol.probability) || 0);
      const erpMatches = erpByOdooId.get(odooId) || [];

      if (erpMatches.length === 0) {
        results.push({
          odoo_id: odooId, erp_id: null, status: "MISSING_IN_ERP",
          diffs: ["No ERP record"], action: "Create lead + contact",
          odoo_name: ol.name, odoo_stage: stageName, auto_fixable: false,
        });
        missingCount++;
      } else if (erpMatches.length > 1) {
        results.push({
          odoo_id: odooId, erp_id: erpMatches.map(m => m.id).join(", "), status: "DUPLICATE",
          diffs: [`${erpMatches.length} ERP records for same odoo_id`], action: "Merge duplicates",
          odoo_name: ol.name, odoo_stage: stageName, auto_fixable: false,
        });
        dupCount++;
      } else {
        const erp = erpMatches[0];
        const diffs: string[] = [];
        if (erp.stage !== expectedErpStage) diffs.push(`stage: ${erp.stage} → ${expectedErpStage}`);
        if (Math.abs((erp.expected_value || 0) - (Number(ol.expected_revenue) || 0)) > 0.01) {
          diffs.push(`value: ${erp.expected_value} → ${ol.expected_revenue}`);
        }
        if (!erp.customer_id && expectedErpStage !== "won" && expectedErpStage !== "lost") {
          diffs.push("customer_id is null (active lead)");
        }
        const odooDeadline = ol.date_deadline || null;
        if (odooDeadline && erp.expected_close_date !== odooDeadline) {
          diffs.push(`deadline: ${erp.expected_close_date} → ${odooDeadline}`);
        }

        if (diffs.length === 0) {
          results.push({
            odoo_id: odooId, erp_id: erp.id, status: "MATCH",
            diffs: [], action: "None",
            odoo_name: ol.name, odoo_stage: stageName, erp_stage: erp.stage,
            auto_fixable: false,
          });
          matchCount++;
        } else {
          // Determine if auto-fixable (stage + value diffs are safe to auto-fix)
          const isAutoFixable = diffs.every(d =>
            d.startsWith("stage:") || d.startsWith("value:") || d.startsWith("deadline:")
          );

          results.push({
            odoo_id: odooId, erp_id: erp.id, status: "OUT_OF_SYNC",
            diffs, action: autoFix && isAutoFixable ? "Auto-fixing" : "Patch ERP fields",
            odoo_name: ol.name, odoo_stage: stageName, erp_stage: erp.stage,
            auto_fixable: isAutoFixable,
          });
          syncCount++;

          // === AUTO-FIX MODE ===
          if (autoFix && isAutoFixable) {
            const updatePayload: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
            };
            if (erp.stage !== expectedErpStage) {
              updatePayload.stage = expectedErpStage;
            }
            const expectedRevenue = Number(ol.expected_revenue) || 0;
            if (Math.abs((erp.expected_value || 0) - expectedRevenue) > 0.01) {
              updatePayload.expected_value = expectedRevenue;
            }
            if (odooDeadline && erp.expected_close_date !== odooDeadline) {
              updatePayload.expected_close_date = odooDeadline;
            }

            const { error } = await serviceClient
              .from("leads")
              .update(updatePayload)
              .eq("id", erp.id);

            if (!error) {
              fixedCount++;
              // Update the result row action
              results[results.length - 1].action = "Auto-fixed";
            } else {
              console.error(`Auto-fix failed for ${erp.id}:`, error);
              results[results.length - 1].action = "Auto-fix failed: " + error.message;
            }
          }
        }
      }
    }

    // === DRIFT DETECTION: ERP leads not in Odoo window ===
    const odooIdSet = new Set(odooLeads.map((ol: Record<string, unknown>) => String(ol.id)));
    let driftCount = 0;
    const driftLeads: Array<{ erp_id: string; odoo_id: string; stage: string }> = [];
    for (const l of erpLeads) {
      const oid = (l.metadata as Record<string, unknown>)?.odoo_id as string;
      if (oid && !odooIdSet.has(oid) && !["won", "loss", "lost", "merged", "no_rebars_out_of_scope", "delivered_pickup_done", "archived_orphan"].includes(l.stage)) {
        driftLeads.push({ erp_id: l.id, odoo_id: oid, stage: l.stage });
        driftCount++;
      }
    }

    // Store reconciliation run
    await serviceClient.from("reconciliation_runs").insert({
      window_days: 5,
      results,
      created_count: 0,
      updated_count: fixedCount,
      missing_count: missingCount,
      out_of_sync_count: syncCount,
      duplicate_count: dupCount,
    });

    return json({
      summary: {
        total: odooLeads.length,
        match: matchCount,
        missing: missingCount,
        out_of_sync: syncCount,
        duplicate: dupCount,
        auto_fixed: fixedCount,
        drift_detected: driftCount,
      },
      results,
      drift: driftLeads.slice(0, 50), // Cap drift report to 50 for response size
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Reconciliation error:", err);
    return json({ error: err.message || "Reconciliation failed" }, 500);
  }
});
