import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Odoo stage name → pipeline stage slug
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
  "estimation - karthick": "estimation_karthick",
  "estimation karthick": "estimation_karthick",
  "hot enquiries": "hot_enquiries",
  "hot": "hot_enquiries",
  "quotation priority": "quotation_priority",
  "quotation bids": "quotation_bids",
  "quotation": "quotation_bids",
  "won": "won",
  "lost": "lost",
  "shop drawing": "shop_drawing",
  "shop drawing approval": "shop_drawing_approval",
  "shop drawing sent for approval": "shop_drawing_approval",
};

// ── Odoo JSON-RPC helpers ──

interface OdooSession {
  sessionId: string;
  url: string;
}

async function odooAuthenticate(): Promise<OdooSession> {
  const rawUrl = Deno.env.get("ODOO_URL")!;
  // Strip any path – keep only the origin (protocol + host)
  const parsed = new URL(rawUrl.trim());
  const url = parsed.origin;
  const db = Deno.env.get("ODOO_DATABASE")!;
  const login = Deno.env.get("ODOO_USERNAME")!;
  const password = Deno.env.get("ODOO_API_KEY")!;

  console.log(`Odoo connect: url=${url}, db=${db}, login=${login}`);

  const authUrl = `${url}/web/session/authenticate`;
  console.log(`POST ${authUrl}`);
  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      params: { db, login, password },
    }),
  });

  if (!res.ok) throw new Error(`Odoo auth HTTP ${res.status}`);

  const json = await res.json();
  if (json.error) throw new Error(`Odoo auth error: ${JSON.stringify(json.error)}`);
  if (!json.result?.uid) throw new Error("Odoo auth failed – no uid returned");

  // Extract session_id cookie
  const setCookie = res.headers.get("set-cookie") || "";
  const sidMatch = setCookie.match(/session_id=([^;]+)/);
  const sessionId = sidMatch ? sidMatch[1] : "";

  return { sessionId, url };
}

async function odooSearchRead(
  session: OdooSession,
  model: string,
  fields: string[],
  domain: unknown[] = [],
  limit = 0,
): Promise<unknown[]> {
  const res = await fetch(`${session.url}/web/dataset/call_kw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        model,
        method: "search_read",
        args: [domain],
        kwargs: {
          fields,
          limit: limit || false,
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Odoo ${model} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Odoo ${model} error: ${JSON.stringify(json.error)}`);
  return json.result || [];
}

// ── Stage mapper ──

function mapOdooStage(stageName: string): string {
  const key = stageName.toLowerCase().trim();
  return ODOO_STAGE_MAP[key] || "new";
}

// ── Next sequential lead number ──

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

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    // 1. Authenticate with Odoo
    console.log("Authenticating with Odoo...");
    const session = await odooAuthenticate();
    console.log("Odoo auth successful");

    // 2. Fetch stages for name mapping
    const odooStages = await odooSearchRead(session, "crm.stage", ["id", "name"]) as Array<{ id: number; name: string }>;
    const stageIdToName = new Map<number, string>();
    for (const s of odooStages) stageIdToName.set(s.id, s.name);
    console.log(`Fetched ${odooStages.length} Odoo stages`);

    // 3. Fetch all leads/opportunities
    const odooLeads = await odooSearchRead(session, "crm.lead", [
      "id", "name", "stage_id", "partner_id", "contact_name", "email_from",
      "phone", "mobile", "expected_revenue", "probability", "date_deadline",
      "user_id", "description", "create_date", "write_date", "priority", "type",
    ]) as Array<Record<string, unknown>>;
    console.log(`Fetched ${odooLeads.length} Odoo leads`);

    if (!odooLeads.length) {
      return new Response(
        JSON.stringify({ synced: 0, updated: 0, skipped: 0, total: 0, details: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Load existing leads for dedup
    const odooSourceIds = odooLeads.map(l => `odoo_crm_${l.id}`);
    const { data: existingBySource } = await supabaseAdmin
      .from("leads")
      .select("id, title, stage, source_email_id")
      .in("source_email_id", odooSourceIds);

    const sourceMap = new Map<string, { id: string; title: string; stage: string }>();
    for (const l of existingBySource || []) {
      if (l.source_email_id) sourceMap.set(l.source_email_id, l);
    }

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    const details: Array<{ odoo_id: number; name: string; action: string }> = [];

    let currentNum = await getNextLeadNumber(supabaseAdmin);

    for (const ol of odooLeads) {
      const odooId = ol.id as number;
      const sourceEmailId = `odoo_crm_${odooId}`;
      const leadName = (ol.name as string) || "Unnamed Lead";

      // Stage mapping
      const stageArr = ol.stage_id as [number, string] | false;
      const stageName = stageArr ? stageArr[1] : "New";
      const mappedStage = mapOdooStage(stageName);

      // Salesperson
      const userArr = ol.user_id as [number, string] | false;
      const salesperson = userArr ? userArr[1] : null;

      // Contact / partner
      const partnerArr = ol.partner_id as [number, string] | false;
      const partnerName = partnerArr ? partnerArr[1] : null;
      const contactName = (ol.contact_name as string) || partnerName || null;
      const email = (ol.email_from as string) || null;
      const phone = (ol.phone as string) || (ol.mobile as string) || null;

      // Revenue / probability
      const expectedRevenue = (ol.expected_revenue as number) || 0;
      const probability = (ol.probability as number) || 0;
      const deadline = (ol.date_deadline as string) || null;
      const description = (ol.description as string) || null;

      // Check if already synced
      const existing = sourceMap.get(sourceEmailId);

      if (existing && !force) {
        // Update stage + value if changed
        if (existing.stage !== mappedStage || force) {
          const { error: updateErr } = await supabaseAdmin
            .from("leads")
            .update({
              stage: mappedStage,
              expected_close_date: deadline ? new Date(deadline).toISOString() : null,
              updated_at: new Date().toISOString(),
              metadata: {
                odoo_id: odooId,
                odoo_stage: stageName,
                odoo_probability: probability,
                odoo_revenue: expectedRevenue,
                odoo_salesperson: salesperson,
                synced_at: new Date().toISOString(),
              },
            })
            .eq("id", existing.id);

          if (!updateErr) {
            updated++;
            details.push({ odoo_id: odooId, name: leadName, action: `updated_stage_to_${mappedStage}` });
          }
        } else {
          skipped++;
          details.push({ odoo_id: odooId, name: leadName, action: "no_change" });
        }
        continue;
      }

      if (existing && force) {
        // Force update
        await supabaseAdmin
          .from("leads")
          .update({
            stage: mappedStage,
            expected_close_date: deadline ? new Date(deadline).toISOString() : null,
            notes: description ? description.substring(0, 2000) : null,
            updated_at: new Date().toISOString(),
            metadata: {
              odoo_id: odooId,
              odoo_stage: stageName,
              odoo_probability: probability,
              odoo_revenue: expectedRevenue,
              odoo_salesperson: salesperson,
              odoo_contact: contactName,
              odoo_email: email,
              odoo_phone: phone,
              synced_at: new Date().toISOString(),
            },
          })
          .eq("id", existing.id);
        updated++;
        details.push({ odoo_id: odooId, name: leadName, action: "force_updated" });
        continue;
      }

      // Create new lead
      const leadNumber = `S${String(currentNum).padStart(5, "0")}`;
      currentNum++;
      const leadTitle = `${leadNumber}, ${leadName}`;

      // Find or create customer
      let customerId: string | null = null;
      if (contactName || email) {
        // Try to find existing customer by name
        if (partnerName) {
          const { data: existingCustomer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("company_id", profile.company_id)
            .ilike("name", partnerName)
            .limit(1)
            .maybeSingle();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const { data: newCustomer } = await supabaseAdmin
              .from("customers")
              .insert({
                name: partnerName,
                company_id: profile.company_id,
                status: "active",
              })
              .select("id")
              .single();
            customerId = newCustomer?.id || null;
          }
        }

        // Create contact if we have details
        if (customerId && (contactName || email)) {
          const nameParts = (contactName || "").split(" ");
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts.slice(1).join(" ") || null;

          // Check if contact already exists
          const { data: existingContact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("customer_id", customerId)
            .eq("first_name", firstName)
            .limit(1)
            .maybeSingle();

          if (!existingContact) {
            await supabaseAdmin.from("contacts").insert({
              customer_id: customerId,
              company_id: profile.company_id,
              first_name: firstName,
              last_name: lastName,
              email: email,
              phone: phone,
              is_primary: true,
            });
          }
        }
      }

      const noteParts: string[] = [];
      if (salesperson) noteParts.push(`Salesperson: ${salesperson}`);
      if (probability) noteParts.push(`Probability: ${probability}%`);
      if (expectedRevenue) noteParts.push(`Expected Revenue: $${expectedRevenue.toLocaleString()}`);
      if (description) noteParts.push(description.substring(0, 500));

      const { data: newLead, error: insertError } = await supabaseAdmin
        .from("leads")
        .insert({
          title: leadTitle,
          description: `Synced from Odoo CRM (${stageName}).`,
          stage: mappedStage,
          source: "odoo_sync",
          source_email_id: sourceEmailId,
          priority: ol.priority === "3" ? "high" : ol.priority === "2" ? "high" : "medium",
          expected_close_date: deadline ? new Date(deadline).toISOString() : null,
          company_id: profile.company_id,
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
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert Odoo lead:", insertError);
        if (insertError.code === "23505") {
          skipped++;
          details.push({ odoo_id: odooId, name: leadName, action: "duplicate_key" });
        }
        continue;
      }

      // Log timeline activity
      if (newLead?.id) {
        await supabaseAdmin.from("lead_activities").insert({
          lead_id: newLead.id,
          company_id: profile.company_id,
          activity_type: "note",
          title: "Synced from Odoo CRM",
          description: `Lead "${leadName}" imported from Odoo.\nStage: ${stageName}\n${salesperson ? `👤 ${salesperson}` : ""}\n${deadline ? `📅 Deadline: ${deadline}` : ""}`.trim(),
          created_by: "Blitz AI",
        });
      }

      synced++;
      details.push({ odoo_id: odooId, name: leadName, action: "created" });
    }

    console.log(`Odoo CRM sync complete: ${synced} synced, ${updated} updated, ${skipped} skipped out of ${odooLeads.length} leads`);

    return new Response(
      JSON.stringify({ synced, updated, skipped, total: odooLeads.length, details }),
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
