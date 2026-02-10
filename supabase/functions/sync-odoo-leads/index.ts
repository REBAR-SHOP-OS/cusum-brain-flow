import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Odoo stage keywords → pipeline stage mapping
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

/**
 * Parse OdooBot email to extract lead name, stage, assignee, deadline.
 *
 * Known patterns:
 * Subject: "Lead Name: Chk new lead moved to CRM stages" assigned to you
 * Subject: You have been assigned to Lead Name
 * Body: Document: "Lead Name" (Lead/Opportunity) Summary: ... Deadline: MM/DD/YYYY
 */
interface OdooParsed {
  leadName: string;
  stage: string | null;
  assignee: string | null;
  assigneeEmail: string | null;
  deadline: string | null;
  type: "activity_assigned" | "lead_assigned" | "unknown";
}

function parseOdooEmail(subject: string, body: string, toAddress: string): OdooParsed {
  const result: OdooParsed = {
    leadName: "",
    stage: null,
    assignee: null,
    assigneeEmail: null,
    deadline: null,
    type: "unknown",
  };

  // Extract assignee from to_address: "Name <email>"
  const toMatch = toAddress.match(/^([^<]+)<([^>]+)>/);
  if (toMatch) {
    result.assignee = toMatch[1].trim();
    result.assigneeEmail = toMatch[2].trim().toLowerCase();
  }

  // Pattern 1: Activity assigned — "LeadName: Chk new lead moved to CRM stages" assigned to you
  const activityMatch = subject.match(/^"(.+?):\s*Chk new lead moved to CRM stages"\s*assigned to you/i);
  if (activityMatch) {
    result.leadName = activityMatch[1].trim();
    result.type = "activity_assigned";
    // Stage comes from body: Summary line or context
    result.stage = "new"; // default — these are "moved to CRM stages" = new in pipeline
  }

  // Pattern 2: Lead assigned — "You have been assigned to LeadName"
  if (!result.leadName) {
    const assignedMatch = subject.match(/^You have been assigned to\s+(.+)$/i);
    if (assignedMatch) {
      result.leadName = assignedMatch[1].trim();
      result.type = "lead_assigned";
    }
  }

  // Pattern 3: Generic subject with quotes — "LeadName: Summary" assigned to you
  if (!result.leadName) {
    const genericMatch = subject.match(/^"(.+?)(?::.*)?"\s*assigned to you/i);
    if (genericMatch) {
      result.leadName = genericMatch[1].trim();
      result.type = "activity_assigned";
    }
  }

  // Extract from body: Document: "Lead Name"
  if (!result.leadName) {
    const docMatch = body.match(/Document:\s*(?:&quot;|")(.+?)(?:&quot;|")/i);
    if (docMatch) {
      result.leadName = docMatch[1].trim();
      result.type = "activity_assigned";
    }
  }

  // Extract deadline from body: Deadline: MM/DD/YYYY
  const deadlineMatch = body.match(/Deadline:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (deadlineMatch) {
    const [month, day, year] = deadlineMatch[1].split("/");
    result.deadline = `${year}-${month}-${day}`;
  }

  // Try to extract stage from body if mentioned
  const stageMatch = body.match(/moved to\s+(?:stage\s+)?["']?([^"'\n]+?)["']?\s*(?:\.|$|<|\\n)/i);
  if (stageMatch) {
    const stageStr = stageMatch[1].trim().toLowerCase();
    if (ODOO_STAGE_MAP[stageStr]) {
      result.stage = ODOO_STAGE_MAP[stageStr];
    }
  }

  return result;
}

/**
 * Fuzzy-match a lead name against existing leads.
 */
function findExistingLead(
  leadName: string,
  existingLeads: Array<{ id: string; title: string; source: string | null; source_email_id: string | null }>
): { id: string; title: string } | null {
  if (!leadName) return null;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

  const target = normalize(leadName);
  if (!target) return null;

  for (const lead of existingLeads) {
    const title = normalize(lead.title);
    // Check if the Odoo lead name appears in the existing title
    if (title.includes(target) || target.includes(title)) return lead;
    // Token overlap
    const targetTokens = new Set(target.split(" ").filter(t => t.length > 2));
    const titleTokens = new Set(title.split(" ").filter(t => t.length > 2));
    if (targetTokens.size > 0 && titleTokens.size > 0) {
      let overlap = 0;
      for (const t of targetTokens) if (titleTokens.has(t)) overlap++;
      const score = (2 * overlap) / (targetTokens.size + titleTokens.size);
      if (score >= 0.6) return lead;
    }
  }
  return null;
}

/**
 * Get next sequential lead number (SXXXXX format)
 */
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
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

    // 1. Fetch all OdooBot emails from communications
    const { data: odooEmails, error: queryError } = await supabaseAdmin
      .from("communications")
      .select("id, source_id, from_address, to_address, subject, body_preview, metadata, received_at")
      .ilike("from_address", "%OdooBot%")
      .order("received_at", { ascending: false })
      .limit(500);

    if (queryError) throw queryError;

    if (!odooEmails?.length) {
      return new Response(
        JSON.stringify({ synced: 0, updated: 0, skipped: 0, total: 0, details: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check already-processed Odoo emails
    const odooSourceIds = odooEmails.map(e => `odoo_${e.id}`);
    const { data: existingOdoo } = await supabaseAdmin
      .from("leads")
      .select("source_email_id, title, stage")
      .in("source_email_id", odooSourceIds);

    const processedMap = new Map<string, { title: string; stage: string }>();
    for (const l of existingOdoo || []) {
      if (l.source_email_id) processedMap.set(l.source_email_id, { title: l.title, stage: l.stage });
    }

    // 3. Fetch all existing leads for fuzzy matching
    const { data: allLeads } = await supabaseAdmin
      .from("leads")
      .select("id, title, source, source_email_id, stage")
      .eq("company_id", profile.company_id);

    const existingLeads = allLeads || [];

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    const details: Array<{ comm_id: string; leadName: string; action: string }> = [];

    let currentNum = await getNextLeadNumber(supabaseAdmin);

    // Group emails by lead name to avoid creating duplicates within this batch
    const seenLeadNames = new Map<string, string>(); // normalized name → lead_id

    for (const email of odooEmails) {
      const sourceEmailId = `odoo_${email.id}`;

      // Skip if already processed (unless force)
      if (!force && processedMap.has(sourceEmailId)) {
        skipped++;
        details.push({ comm_id: email.id, leadName: "", action: "already_processed" });
        continue;
      }

      const parsed = parseOdooEmail(
        email.subject || "",
        email.body_preview || "",
        email.to_address || ""
      );

      if (!parsed.leadName) {
        skipped++;
        details.push({ comm_id: email.id, leadName: "(unparseable)", action: "no_lead_name" });
        continue;
      }

      // Skip "Lead Acquisition" leaderboard reports
      if (parsed.leadName.toLowerCase() === "lead acquisition") {
        skipped++;
        details.push({ comm_id: email.id, leadName: parsed.leadName, action: "leaderboard_report" });
        continue;
      }

      // Check if we already created this lead in this batch
      const normalizedName = parsed.leadName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      if (seenLeadNames.has(normalizedName)) {
        skipped++;
        details.push({ comm_id: email.id, leadName: parsed.leadName, action: "batch_duplicate" });
        continue;
      }

      // Check if lead already exists in pipeline (fuzzy match)
      const existingLead = findExistingLead(parsed.leadName, existingLeads);

      if (existingLead) {
        // Update stage if Odoo shows a different/newer stage
        if (parsed.stage && parsed.stage !== "new") {
          // Only update if the Odoo stage is more advanced
          const { error: updateErr } = await supabaseAdmin
            .from("leads")
            .update({
              stage: parsed.stage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingLead.id);

          if (!updateErr) {
            updated++;
            details.push({ comm_id: email.id, leadName: parsed.leadName, action: `updated_stage_to_${parsed.stage}` });
          }
        } else {
          skipped++;
          details.push({ comm_id: email.id, leadName: parsed.leadName, action: "exists_no_change" });
        }
        seenLeadNames.set(normalizedName, existingLead.id);
        continue;
      }

      // Create new lead
      const leadNumber = `S${String(currentNum).padStart(5, "0")}`;
      currentNum++;
      const leadTitle = `${leadNumber}, ${parsed.leadName}`;

      const noteParts: string[] = [];
      if (parsed.assignee) noteParts.push(`Assigned: ${parsed.assignee}`);
      if (parsed.assigneeEmail) noteParts.push(`Assignee Email: ${parsed.assigneeEmail}`);
      if (parsed.deadline) noteParts.push(`Deadline: ${parsed.deadline}`);
      noteParts.push(`Odoo Type: ${parsed.type}`);
      noteParts.push(`Source Subject: ${email.subject}`);

      const { data: newLead, error: insertError } = await supabaseAdmin
        .from("leads")
        .insert({
          title: leadTitle,
          description: `Synced from Odoo CRM via OdooBot email notification.`,
          stage: parsed.stage || "new",
          source: "odoo_sync",
          source_email_id: sourceEmailId,
          priority: "medium",
          expected_close_date: parsed.deadline ? new Date(parsed.deadline).toISOString() : null,
          company_id: profile.company_id,
          notes: noteParts.join(" | "),
          metadata: {
            odoo_lead_name: parsed.leadName,
            odoo_assignee: parsed.assignee,
            odoo_assignee_email: parsed.assigneeEmail,
            odoo_type: parsed.type,
            odoo_subject: email.subject,
            synced_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert Odoo lead:", insertError);
        if (insertError.code === "23505") {
          skipped++;
          details.push({ comm_id: email.id, leadName: parsed.leadName, action: "duplicate_key" });
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
          description: `Lead "${parsed.leadName}" imported from Odoo via OdooBot email.\n${parsed.assignee ? `👤 Assigned to: ${parsed.assignee}` : ""}\n${parsed.deadline ? `📅 Deadline: ${parsed.deadline}` : ""}`.trim(),
          created_by: "Blitz AI",
        });

        seenLeadNames.set(normalizedName, newLead.id);
        existingLeads.push({ id: newLead.id, title: leadTitle, source: "odoo_sync", source_email_id: sourceEmailId, stage: parsed.stage || "new" });
      }

      synced++;
      details.push({ comm_id: email.id, leadName: parsed.leadName, action: "created" });
    }

    console.log(`Odoo sync complete: ${synced} synced, ${updated} updated, ${skipped} skipped out of ${odooEmails.length} emails`);

    return new Response(
      JSON.stringify({ synced, updated, skipped, total: odooEmails.length, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-odoo-leads error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
