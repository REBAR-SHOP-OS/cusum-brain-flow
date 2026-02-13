import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const STAGE_MAP: Record<string, string> = {
  "New": "new",
  "Telephonic Enquiries": "telephonic_enquiries",
  "Qualified": "qualified",
  "RFI": "rfi",
  "Addendums": "addendums",
  "Estimation-Ben": "estimation_ben",
  "Estimation-Karthick(Mavericks)": "estimation_karthick",
  "QC - Ben": "qc_ben",
  "Hot Enquiries": "hot_enquiries",
  "Quotation Priority": "quotation_priority",
  "Quotation Bids": "quotation_bids",
  "Shop Drawing": "shop_drawing",
  "Shop Drawing Sent for Approval": "shop_drawing_approval",
  "Fabrication In Shop": "shop_drawing",
  "Delivered/Pickup Done": "won",
  "Ready To Dispatch/Pickup": "won",
  "Won": "won",
  "Loss": "lost",
  "Merged": "lost",
  "No rebars(Our of Scope)": "lost",
};

const FIELDS = [
  "id", "name", "stage_id", "email_from", "phone", "contact_name",
  "user_id", "probability", "expected_revenue", "type", "partner_name",
  "city", "create_date", "write_date", "priority",
];

async function odooRpc(url: string, db: string, apiKey: string, model: string, method: string, args: unknown[]) {
  const rpcArgs = [db, 2, apiKey, model, method, ...args];
  console.log("RPC args structure:", JSON.stringify(rpcArgs.map((a, i) => i < 3 ? '***' : a)));
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "call",
      params: {
        service: "object", method: "execute_kw",
        args: rpcArgs,
      },
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("Odoo RPC error detail:", JSON.stringify(data.error));
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceClient } = await requireAuth(req);

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    // Fetch opportunities modified in the last 5 days
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const cutoff = fiveDaysAgo.toISOString().replace("T", " ").slice(0, 19);
    console.log("Fetching opportunities with write_date >=", cutoff);

    const leads = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
      [[["type", "=", "opportunity"], ["write_date", ">=", cutoff]]],
      { fields: FIELDS },
    ]);

    console.log(`Fetched ${leads.length} opportunities from Odoo`);

    // Get company_id from first existing odoo_sync lead
    const { data: sampleLead } = await serviceClient
      .from("leads")
      .select("company_id")
      .eq("source", "odoo_sync")
      .limit(1)
      .single();

    const companyId = sampleLead?.company_id || "a0000000-0000-0000-0000-000000000001";

    // Load existing odoo_id index for fast dedup — keep latest synced_at per odoo_id
    const { data: existingLeads } = await serviceClient
      .from("leads")
      .select("id, metadata")
      .eq("source", "odoo_sync");

    // Build map keeping only the most-recently-synced record per odoo_id
    const odooIdMap = new Map<string, { id: string; syncedAt: string }>();
    const victimIds: string[] = [];

    for (const l of existingLeads || []) {
      const meta = l.metadata as Record<string, unknown> | null;
      const oid = meta?.odoo_id as string;
      if (!oid) continue;

      const syncedAt = (meta?.synced_at as string) || "";
      const existing = odooIdMap.get(oid);

      if (!existing) {
        odooIdMap.set(oid, { id: l.id, syncedAt });
      } else if (syncedAt > existing.syncedAt) {
        // Current record is newer → it's the survivor, old one is victim
        victimIds.push(existing.id);
        odooIdMap.set(oid, { id: l.id, syncedAt });
      } else {
        // Current record is older → it's the victim
        victimIds.push(l.id);
      }
    }

    // Clean up any duplicates found during map loading
    if (victimIds.length > 0) {
      console.log(`Dedup: deleting ${victimIds.length} duplicate leads`);
      for (let i = 0; i < victimIds.length; i += 50) {
        const batch = victimIds.slice(i, i + 50);
        await serviceClient.from("leads").delete().in("id", batch);
      }
    }

    let created = 0, updated = 0, skipped = 0, errors = 0;

    for (const ol of leads) {
      try {
        const odooId = String(ol.id);
        const stageName = Array.isArray(ol.stage_id) ? ol.stage_id[1] : String(ol.stage_id || "");
        const erpStage = STAGE_MAP[stageName] || "new";
        const salesperson = Array.isArray(ol.user_id) ? ol.user_id[1] : null;

        const metadata: Record<string, unknown> = {
          odoo_id: odooId,
          odoo_stage: stageName,
          odoo_salesperson: salesperson,
          odoo_email: ol.email_from || null,
          odoo_phone: ol.phone || null,
          odoo_contact: ol.contact_name || null,
          odoo_probability: ol.probability || 0,
          odoo_revenue: ol.expected_revenue || 0,
          odoo_partner: ol.partner_name || null,
          odoo_city: ol.city || null,
          odoo_priority: ol.priority || "0",
          odoo_type: ol.type || null,
          synced_at: new Date().toISOString(),
        };

        const existingEntry = odooIdMap.get(odooId);
        const existingId = existingEntry?.id;

        // Normalize probability: won=100, lost=0, others=Odoo ML value
        const normalizedProb = erpStage === "won" ? 100 : erpStage === "lost" ? 0 : Math.round(Number(ol.probability) || 0);

        if (existingId) {
          // Update existing lead (including title to fix S-prefix legacy titles)
          const { error } = await serviceClient
            .from("leads")
            .update({
              title: ol.name || "Untitled",
              stage: erpStage,
              probability: normalizedProb,
              expected_value: Number(ol.expected_revenue) || 0,
              metadata,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId);

          if (error) { console.error(`Update error for odoo_id ${odooId}:`, error); errors++; }
          else updated++;
        } else {
          // Create new lead
          const customerName = ol.partner_name || ol.contact_name || "Unknown";

          // Find or create customer
          let customerId: string | null = null;
          const { data: existingCust } = await serviceClient
            .from("customers")
            .select("id")
            .eq("name", customerName)
            .eq("company_id", companyId)
            .limit(1)
            .single();

          if (existingCust) {
            customerId = existingCust.id;
          } else {
            const { data: newCust } = await serviceClient
              .from("customers")
              .insert({ name: customerName, company_id: companyId, company_name: ol.partner_name || null })
              .select("id")
              .single();
            customerId = newCust?.id || null;
          }

          const { error } = await serviceClient
            .from("leads")
            .insert({
              title: ol.name || "Untitled",
              stage: erpStage,
              probability: normalizedProb,
              expected_value: Number(ol.expected_revenue) || 0,
              source: "odoo_sync",
              customer_id: customerId,
              company_id: companyId,
              metadata,
              priority: ol.priority === "3" ? "high" : ol.priority === "2" ? "medium" : "low",
            });

          if (error) { console.error(`Insert error for odoo_id ${odooId}:`, error); errors++; }
          else created++;
        }
      } catch (e) {
        console.error("Lead processing error:", e);
        errors++;
      }
    }

    return json({ created, updated, skipped, errors, total: leads.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Sync error:", err);
    return json({ error: err.message || "Sync failed" }, 500);
  }
});
