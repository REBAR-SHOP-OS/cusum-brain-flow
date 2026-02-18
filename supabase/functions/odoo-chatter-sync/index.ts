import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const MESSAGE_TYPE_MAP: Record<string, string> = {
  comment: "note",
  email: "email",
  notification: "system",
};

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  "Mail": "email",
  "Email": "email",
  "Call": "call",
  "Meeting": "meeting",
  "To-Do": "todo",
  "To Do": "todo",
  "Upload Document": "todo",
  "Request Signature": "todo",
  "Follow-up": "follow_up",
  "Follow Up": "follow_up",
};

async function odooRpc(url: string, db: string, apiKey: string, model: string, method: string, args: unknown[]) {
  const rpcArgs = [db, 2, apiKey, model, method, ...args];
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "call",
      params: { service: "object", method: "execute_kw", args: rpcArgs },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  return data.result;
}

/** Strip HTML tags for plain text */
function stripHtml(html: string | false): string {
  if (!html || html === false) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceClient } = await requireAuth(req);

    let mode = "missing";
    try {
      const body = await req.json();
      if (body?.mode === "full") mode = "full";
      if (body?.mode === "single" && body?.odoo_id) {
        mode = "single";
        // Handle single-lead test below
        var singleOdooId = String(body.odoo_id);
      }
    } catch { /* no body */ }

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    // Get company_id
    const { data: sampleLead } = await serviceClient
      .from("leads").select("company_id").eq("source", "odoo_sync").limit(1).single();
    const companyId = sampleLead?.company_id || "a0000000-0000-0000-0000-000000000001";

    // === Part 1: Chatter (mail.message) sync ===
    let targetLeads: Array<{ id: string; odoo_id: string }> = [];

    if (mode === "single") {
      // Find the lead with this odoo_id
      const { data } = await serviceClient
        .from("leads").select("id, metadata").eq("source", "odoo_sync");
      targetLeads = (data || [])
        .filter((l: any) => String((l.metadata as any)?.odoo_id) === singleOdooId)
        .map((l: any) => ({ id: l.id, odoo_id: singleOdooId! }));
    } else if (mode === "missing") {
      // Find leads with zero lead_activities
      // Step 1: get all odoo_sync leads
      const allLeads: Array<{ id: string; metadata: any }> = [];
      let from = 0;
      while (true) {
        const { data } = await serviceClient
          .from("leads").select("id, metadata").eq("source", "odoo_sync").range(from, from + 999);
        if (!data || data.length === 0) break;
        allLeads.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      // Step 2: get lead_ids that have activities
      const leadsWithActivities = new Set<string>();
      from = 0;
      while (true) {
        const { data } = await serviceClient
          .from("lead_activities").select("lead_id").range(from, from + 999);
        if (!data || data.length === 0) break;
        data.forEach((r: any) => leadsWithActivities.add(r.lead_id));
        if (data.length < 1000) break;
        from += 1000;
      }

      targetLeads = allLeads
        .filter(l => !leadsWithActivities.has(l.id) && (l.metadata as any)?.odoo_id)
        .map(l => ({ id: l.id, odoo_id: String((l.metadata as any).odoo_id) }));
    } else {
      // full mode: all odoo_sync leads
      const allLeads: Array<{ id: string; metadata: any }> = [];
      let from = 0;
      while (true) {
        const { data } = await serviceClient
          .from("leads").select("id, metadata").eq("source", "odoo_sync").range(from, from + 999);
        if (!data || data.length === 0) break;
        allLeads.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      targetLeads = allLeads
        .filter(l => (l.metadata as any)?.odoo_id)
        .map(l => ({ id: l.id, odoo_id: String((l.metadata as any).odoo_id) }));
    }

    console.log(`Chatter sync: ${targetLeads.length} leads to process (mode=${mode})`);

    // Build odoo_id → lead_id map
    const odooToLead = new Map<number, string>();
    targetLeads.forEach(l => odooToLead.set(Number(l.odoo_id), l.id));

    let messagesInserted = 0;
    let messagesSkipped = 0;
    let messageErrors = 0;

    // Process in batches of 50 odoo IDs
    const odooIds = targetLeads.map(l => Number(l.odoo_id));
    for (let i = 0; i < odooIds.length; i += 50) {
      const batch = odooIds.slice(i, i + 50);
      try {
        const messages = await odooRpc(odooUrl, odooDB, odooKey, "mail.message", "search_read", [
          [[["model", "=", "crm.lead"], ["res_id", "in", batch]]],
          { fields: ["id", "body", "subject", "message_type", "subtype_id", "author_id", "date", "res_id"] },
        ]);

        console.log(`Batch ${i / 50 + 1}: fetched ${messages.length} messages for ${batch.length} leads`);

        // Build insert rows
        const rows: any[] = [];
        for (const msg of messages) {
          const leadId = odooToLead.get(msg.res_id);
          if (!leadId) continue;

          const activityType = MESSAGE_TYPE_MAP[msg.message_type] || "note";
          const authorName = Array.isArray(msg.author_id) ? msg.author_id[1] : null;
          const body = stripHtml(msg.body);
          const subject = msg.subject || null;

          // Skip empty notification messages
          if (activityType === "system" && !body && !subject) continue;

          rows.push({
            lead_id: leadId,
            company_id: companyId,
            activity_type: activityType,
            title: subject || (activityType === "email" ? "Email" : activityType === "system" ? "System Update" : "Note"),
            description: body || null,
            created_by: authorName,
            created_at: msg.date ? msg.date.replace(" ", "T") + "Z" : new Date().toISOString(),
            odoo_message_id: msg.id,
            metadata: { odoo_subtype: Array.isArray(msg.subtype_id) ? msg.subtype_id[1] : null },
          });
        }

        // Insert in chunks of 100, using upsert on odoo_message_id
        for (let j = 0; j < rows.length; j += 100) {
          const chunk = rows.slice(j, j + 100);
          const { error } = await serviceClient
            .from("lead_activities")
            .upsert(chunk, { onConflict: "odoo_message_id", ignoreDuplicates: true });
          if (error) {
            console.error("Insert error:", error.message);
            messageErrors += chunk.length;
          } else {
            messagesInserted += chunk.length;
          }
        }
      } catch (e) {
        console.error(`Batch error at offset ${i}:`, e);
        messageErrors += batch.length;
      }
    }

    // === Part 2: Scheduled Activities (mail.activity) sync ===
    let activitiesInserted = 0;
    let activityErrors = 0;

    // Fetch ALL mail.activity for crm.lead — they tend to be few (tens to hundreds)
    // Get all odoo_ids from ALL leads (not just missing ones)
    const allOdooLeads: Array<{ id: string; metadata: any }> = [];
    let from2 = 0;
    while (true) {
      const { data } = await serviceClient
        .from("leads").select("id, metadata").eq("source", "odoo_sync").range(from2, from2 + 999);
      if (!data || data.length === 0) break;
      allOdooLeads.push(...data);
      if (data.length < 1000) break;
      from2 += 1000;
    }

    const allOdooIdMap = new Map<number, string>();
    allOdooLeads.forEach(l => {
      const oid = (l.metadata as any)?.odoo_id;
      if (oid) allOdooIdMap.set(Number(oid), l.id);
    });

    const allOdooIdsForActivities = Array.from(allOdooIdMap.keys());
    console.log(`Scheduled activities: checking ${allOdooIdsForActivities.length} leads in Odoo`);

    for (let i = 0; i < allOdooIdsForActivities.length; i += 50) {
      const batch = allOdooIdsForActivities.slice(i, i + 50);
      try {
        const activities = await odooRpc(odooUrl, odooDB, odooKey, "mail.activity", "search_read", [
          [[["res_model", "=", "crm.lead"], ["res_id", "in", batch]]],
          { fields: ["id", "summary", "note", "activity_type_id", "date_deadline", "user_id", "state", "res_id"] },
        ]);

        if (activities.length === 0) continue;
        console.log(`Scheduled activities batch ${i / 50 + 1}: ${activities.length} activities`);

        const rows: any[] = [];
        for (const act of activities) {
          const leadId = allOdooIdMap.get(act.res_id);
          if (!leadId) continue;

          const typeName = Array.isArray(act.activity_type_id) ? act.activity_type_id[1] : "";
          const activityType = ACTIVITY_TYPE_MAP[typeName] || "todo";
          const assignedName = Array.isArray(act.user_id) ? act.user_id[1] : null;
          const status = act.state === "done" ? "done" : "planned";

          rows.push({
            company_id: companyId,
            entity_type: "lead",
            entity_id: leadId,
            activity_type: activityType,
            summary: act.summary || typeName || "Activity",
            note: stripHtml(act.note) || null,
            due_date: act.date_deadline,
            assigned_name: assignedName,
            status,
            completed_at: status === "done" ? new Date().toISOString() : null,
          });
        }

        // Insert (no upsert — scheduled_activities doesn't have odoo dedup column)
        for (let j = 0; j < rows.length; j += 100) {
          const chunk = rows.slice(j, j + 100);
          const { error } = await serviceClient.from("scheduled_activities").insert(chunk);
          if (error) {
            console.error("Scheduled activity insert error:", error.message);
            activityErrors += chunk.length;
          } else {
            activitiesInserted += chunk.length;
          }
        }
      } catch (e) {
        console.error(`Activity batch error at offset ${i}:`, e);
        activityErrors += 50;
      }
    }

    return json({
      mode,
      leads_processed: targetLeads.length,
      messages_inserted: messagesInserted,
      messages_skipped: messagesSkipped,
      message_errors: messageErrors,
      activities_inserted: activitiesInserted,
      activity_errors: activityErrors,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Chatter sync error:", err);
    return json({ error: err.message || "Chatter sync failed" }, 500);
  }
});
