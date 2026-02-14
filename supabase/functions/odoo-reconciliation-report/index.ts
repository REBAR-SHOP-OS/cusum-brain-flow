import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const STAGE_MAP: Record<string, string> = {
  "New": "new", "Telephonic Enquiries": "telephonic_enquiries",
  "Qualified": "qualified", "RFI": "rfi", "Addendums": "addendums",
  "Estimation-Ben": "estimation_ben", "Estimation-Karthick(Mavericks)": "estimation_karthick",
  "QC - Ben": "qc_ben", "Hot Enquiries": "hot_enquiries",
  "Quotation Priority": "quotation_priority", "Quotation Bids": "quotation_bids",
  "Shop Drawing": "shop_drawing", "Shop Drawing Sent for Approval": "shop_drawing_approval",
  "Fabrication In Shop": "shop_drawing", "Delivered/Pickup Done": "won",
  "Ready To Dispatch/Pickup": "won", "Won": "won",
  "Loss": "lost", "Merged": "lost", "No rebars(Our of Scope)": "lost",
};

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceClient } = await requireAuth(req);

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const cutoff = fiveDaysAgo.toISOString().replace("T", " ").slice(0, 19);

    const odooLeads = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
      [[["type", "=", "opportunity"], ["write_date", ">=", cutoff]]],
      { fields: ["id", "name", "stage_id", "probability", "expected_revenue", "partner_name"] },
    ]);

    // Load all ERP odoo_sync leads
    const erpLeads: Array<{ id: string; metadata: unknown; stage: string; expected_value: number; customer_id: string | null }> = [];
    let from = 0;
    while (true) {
      const { data } = await serviceClient
        .from("leads")
        .select("id, metadata, stage, expected_value, customer_id")
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
          odoo_name: ol.name, odoo_stage: stageName,
        });
        missingCount++;
      } else if (erpMatches.length > 1) {
        results.push({
          odoo_id: odooId, erp_id: erpMatches.map(m => m.id).join(", "), status: "DUPLICATE",
          diffs: [`${erpMatches.length} ERP records for same odoo_id`], action: "Merge duplicates",
          odoo_name: ol.name, odoo_stage: stageName,
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

        if (diffs.length === 0) {
          results.push({
            odoo_id: odooId, erp_id: erp.id, status: "MATCH",
            diffs: [], action: "None",
            odoo_name: ol.name, odoo_stage: stageName, erp_stage: erp.stage,
          });
          matchCount++;
        } else {
          results.push({
            odoo_id: odooId, erp_id: erp.id, status: "OUT_OF_SYNC",
            diffs, action: "Patch ERP fields",
            odoo_name: ol.name, odoo_stage: stageName, erp_stage: erp.stage,
          });
          syncCount++;
        }
      }
    }

    // Store reconciliation run
    await serviceClient.from("reconciliation_runs").insert({
      window_days: 5,
      results,
      created_count: 0,
      updated_count: 0,
      missing_count: missingCount,
      out_of_sync_count: syncCount,
      duplicate_count: dupCount,
    });

    return json({
      summary: { total: odooLeads.length, match: matchCount, missing: missingCount, out_of_sync: syncCount, duplicate: dupCount },
      results,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Reconciliation error:", err);
    return json({ error: err.message || "Reconciliation failed" }, 500);
  }
});
