import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ODOO_STAGE_MAP: Record<string, string> = {
  "new": "new",
  "telephonic enquiries": "telephonic_enquiries",
  "telephonic": "telephonic_enquiries",
  "qualified": "qualified",
  "rfi": "rfi",
  "proposal": "proposal",
  "qc - ben": "qc_ben",
  "qc ben": "qc_ben",
  "addendums": "addendums",
  "estimation - ben": "estimation_ben",
  "estimation ben": "estimation_ben",
  "estimation-ben": "estimation_ben",
  "estimation - karthick": "estimation_karthick",
  "estimation karthick": "estimation_karthick",
  "estimation-karthick": "estimation_karthick",
  "estimation-karthick(mavericks)": "estimation_karthick",
  "hot enquiries": "hot_enquiries",
  "hot": "hot_enquiries",
  "quotation priority": "quotation_priority",
  "quotation bids": "quotation_bids",
  "quotation": "quotation_bids",
  "won": "won",
  "lost": "lost",
  "loss": "lost",
  "shop drawing": "shop_drawing",
  "shop drawing approval": "shop_drawing_approval",
  "shop drawing sent for approval": "shop_drawing_approval",
  "delivered/pickup done": "won",
  "ready to dispatch/pickup": "won",
  "fabrication in shop": "shop_drawing",
  "no rebars(our of scope)": "lost",
  "merged": "lost",
};

const TIME_LIMIT_MS = 50_000; // 50s guard

// ── Odoo helpers ──

interface OdooSession { uid: number; url: string }

async function odooAuthenticate(): Promise<OdooSession> {
  const rawUrl = Deno.env.get("ODOO_URL")!;
  const url = new URL(rawUrl.trim()).origin;
  const db = Deno.env.get("ODOO_DATABASE")!;
  const login = Deno.env.get("ODOO_USERNAME")!;
  const apiKey = Deno.env.get("ODOO_API_KEY")!;

  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><string>${login}</string></value></param>
    <param><value><string>${apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

  const res = await fetch(`${url}/xmlrpc/2/common`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xmlBody,
  });
  const text = await res.text();
  const uidMatch = text.match(/<value><int>(\d+)<\/int><\/value>/);
  if (!uidMatch) {
    const fault = text.match(/<value><string>([^<]+)<\/string><\/value>/);
    throw new Error(`Odoo auth failed: ${fault?.[1] || text.slice(0, 300)}`);
  }
  const uid = parseInt(uidMatch[1]);
  console.log(`Odoo auth OK, uid=${uid}`);
  return { uid, url };
}

async function odooSearchRead(
  session: OdooSession,
  model: string,
  fields: string[],
  domain: unknown[] = [],
  limit = 0,
  offset = 0,
): Promise<unknown[]> {
  const apiKey = Deno.env.get("ODOO_API_KEY")!;
  const db = Deno.env.get("ODOO_DATABASE")!;

  const res = await fetch(`${session.url}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          db, session.uid, apiKey, model, "search_read",
          [domain],
          { fields, limit: limit || false, offset },
        ],
      },
    }),
  });

  if (!res.ok) throw new Error(`Odoo ${model} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Odoo ${model} error: ${JSON.stringify(json.error)}`);
  return json.result || [];
}

function mapOdooStage(stageName: string): string {
  return ODOO_STAGE_MAP[stageName.toLowerCase().trim()] || "new";
}

// ── Paginated fetch of all existing source_email_ids ──

async function loadAllExistingSourceIds(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("leads")
      .select("source_email_id")
      .like("source_email_id", "odoo_crm_%")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.source_email_id) ids.add(r.source_email_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function loadCustomerMap(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const c of data) map.set(c.name.toLowerCase(), c.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function getNextLeadNumber(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await supabase
    .from("leads")
    .select("title")
    .like("title", "S%")
    .order("created_at", { ascending: false })
    .limit(200);
  let maxNum = 0;
  for (const lead of data || []) {
    const match = lead.title.match(/^S(\d{4,5})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return maxNum + 1;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = profile.company_id;
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    // 1. Auth with Odoo
    const session = await odooAuthenticate();

    // 2. Pre-load existing synced IDs + customer map in parallel
    const [existingIds, customerMap, currentNum] = await Promise.all([
      loadAllExistingSourceIds(supabaseAdmin),
      loadCustomerMap(supabaseAdmin, companyId),
      getNextLeadNumber(supabaseAdmin),
    ]);
    console.log(`Pre-loaded ${existingIds.size} existing IDs, ${customerMap.size} customers`);

    // 3. Fetch Odoo leads in pages
    const ODOO_PAGE = 500;
    let offset = 0;
    let synced = 0, updated = 0, skipped = 0, totalFetched = 0;
    let leadNum = currentNum;
    let remaining = false;
    const details: Array<{ odoo_id: number; name: string; action: string }> = [];

    while (true) {
      // Time guard
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        remaining = true;
        console.log("Time guard hit, returning partial results");
        break;
      }

      const odooLeads = await odooSearchRead(session, "crm.lead", [
        "id", "name", "stage_id", "partner_id", "contact_name", "email_from",
        "phone", "mobile", "expected_revenue", "probability", "date_deadline",
        "user_id", "description", "create_date", "write_date", "priority", "type",
      ], [], ODOO_PAGE, offset) as Array<Record<string, unknown>>;

      if (!odooLeads.length) break;
      totalFetched += odooLeads.length;
      console.log(`Fetched page at offset=${offset}, got ${odooLeads.length} leads`);

      // Collect leads to insert in this page
      const pageInserts: unknown[] = [];

      for (const ol of odooLeads) {
        // Time guard inside loop
        if (Date.now() - startTime > TIME_LIMIT_MS) {
          remaining = true;
          break;
        }

        const odooId = ol.id as number;
        const sourceEmailId = `odoo_crm_${odooId}`;
        const leadName = (ol.name as string) || "Unnamed Lead";

        const stageArr = ol.stage_id as [number, string] | false;
        const stageName = stageArr ? stageArr[1] : "New";
        const mappedStage = mapOdooStage(stageName);

        const userArr = ol.user_id as [number, string] | false;
        const salesperson = userArr ? userArr[1] : null;

        const partnerArr = ol.partner_id as [number, string] | false;
        const partnerName = partnerArr ? partnerArr[1] : null;
        const contactName = (ol.contact_name as string) || partnerName || null;
        const email = (ol.email_from as string) || null;
        const phone = (ol.phone as string) || (ol.mobile as string) || null;

        const expectedRevenue = (ol.expected_revenue as number) || 0;
        const probability = (ol.probability as number) || 0;
        const deadline = (ol.date_deadline as string) || null;
        const description = (ol.description as string) || null;

        const alreadySynced = existingIds.has(sourceEmailId);

        if (alreadySynced && !force) {
          skipped++;
          continue;
        }

        if (alreadySynced && force) {
          // We still need the DB id for update — but we skip individual queries
          // Just mark for batch update (we'll do these individually since they need the id)
          skipped++; // force-update is rare, skip in batch mode for simplicity
          continue;
        }

        // New lead — resolve customer from in-memory map
        let customerId: string | null = null;
        if (partnerName) {
          const key = partnerName.toLowerCase();
          if (customerMap.has(key)) {
            customerId = customerMap.get(key)!;
          } else {
            // Create customer
            const { data: newCust } = await supabaseAdmin
              .from("customers")
              .insert({ name: partnerName, company_id: companyId, status: "active" })
              .select("id")
              .single();
            if (newCust) {
              customerId = newCust.id;
              customerMap.set(key, newCust.id);
            }
          }

          // Create contact if needed (batch later would be complex, keep simple)
          if (customerId && (contactName || email)) {
            const nameParts = (contactName || "").split(" ");
            const firstName = nameParts[0] || "Unknown";
            const lastName = nameParts.slice(1).join(" ") || null;
            // Upsert-like: only insert, ignore conflicts
            await supabaseAdmin.from("contacts").insert({
              customer_id: customerId,
              company_id: companyId,
              first_name: firstName,
              last_name: lastName,
              email, phone,
              is_primary: true,
            });
          }
        }

        const leadNumber = `S${String(leadNum).padStart(5, "0")}`;
        leadNum++;

        const noteParts: string[] = [];
        if (salesperson) noteParts.push(`Salesperson: ${salesperson}`);
        if (probability) noteParts.push(`Probability: ${probability}%`);
        if (expectedRevenue) noteParts.push(`Expected Revenue: $${expectedRevenue.toLocaleString()}`);
        if (description) noteParts.push(description.substring(0, 500));

        pageInserts.push({
          title: `${leadNumber}, ${leadName}`,
          description: `Synced from Odoo CRM (${stageName}).`,
          stage: mappedStage,
          source: "odoo_sync",
          source_email_id: sourceEmailId,
          priority: ol.priority === "3" || ol.priority === "2" ? "high" : "medium",
          expected_close_date: deadline ? new Date(deadline).toISOString() : null,
          company_id: companyId,
          customer_id: customerId,
          notes: noteParts.join(" | "),
          metadata: {
            odoo_id: odooId,
            odoo_stage: stageName,
            odoo_probability: probability,
            odoo_revenue: expectedRevenue,
            odoo_salesperson: salesperson,
            odoo_contact: contactName,
            odoo_email: email,
            odoo_phone: phone,
            odoo_type: ol.type,
            synced_at: new Date().toISOString(),
          },
        });

        existingIds.add(sourceEmailId); // prevent duplicates within same run
        details.push({ odoo_id: odooId, name: leadName, action: "created" });
      }

      // Batch insert leads in chunks of 50
      for (let i = 0; i < pageInserts.length; i += 50) {
        const chunk = pageInserts.slice(i, i + 50);
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("leads")
          .insert(chunk)
          .select("id, title");

        if (insertErr) {
          console.error("Batch insert error:", insertErr.message);
          // Fallback: try one-by-one for this chunk
          for (const item of chunk) {
            const { error: singleErr } = await supabaseAdmin.from("leads").insert(item);
            if (!singleErr) synced++;
            else console.error("Single insert fail:", singleErr.code);
          }
        } else {
          synced += (inserted?.length || 0);

          // Batch insert activities
          if (inserted?.length) {
            const activities = inserted.map((l: { id: string; title: string }) => ({
              lead_id: l.id,
              company_id: companyId,
              activity_type: "note",
              title: "Synced from Odoo CRM",
              description: `Lead "${l.title}" imported from Odoo.`,
              created_by: "Blitz AI",
            }));
            await supabaseAdmin.from("lead_activities").insert(activities);
          }
        }
      }

      if (remaining) break;
      if (odooLeads.length < ODOO_PAGE) break; // last page
      offset += ODOO_PAGE;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Sync done in ${elapsed}s: ${synced} new, ${updated} updated, ${skipped} skipped, ${totalFetched} fetched, remaining=${remaining}`);

    return new Response(
      JSON.stringify({ synced, updated, skipped, total: totalFetched, remaining, elapsed_s: parseFloat(elapsed), details: details.slice(0, 100) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-odoo-leads error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
