import { corsHeaders, json } from "../_shared/auth.ts";
import { isOdooEnabled } from "../_shared/featureFlags.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";

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

  // ODOO_ENABLED feature flag guard
  if (!isOdooEnabled()) {
    console.warn("ODOO_ENABLED guard: flag resolved to false");
    return json({ error: "Odoo integration is disabled", disabled: true }, 200);
  }

  try {
    // Dual-path auth: service role key (cron) OR valid user JWT (manual UI trigger)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Schema preflight: ensure odoo_message_id column exists ──
    const { error: schemaErr } = await serviceClient
      .from("lead_files")
      .select("odoo_message_id")
      .limit(0);
    if (schemaErr && schemaErr.message?.includes("odoo_message_id")) {
      console.error("PREFLIGHT FAIL: lead_files.odoo_message_id column does not exist!");
      return json({
        error: "Schema broken: lead_files.odoo_message_id column missing. Run the migration first.",
        preflight_failed: true,
      }, 500);
    }

    if (token !== serviceRoleKey) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

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
          { fields: ["id", "body", "subject", "message_type", "subtype_id", "author_id", "date", "res_id", "tracking_value_ids", "attachment_ids"] },
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
          const rawHtml = (msg.body && msg.body !== false) ? String(msg.body) : null;
          const subject = msg.subject || null;

          // Build tracking changes array
          let trackingChanges: Array<{ field: string; old_value: string; new_value: string }> | null = null;
          if (Array.isArray(msg.tracking_value_ids) && msg.tracking_value_ids.length > 0) {
            try {
              const trackingData = await odooRpc(odooUrl, odooDB, odooKey, "mail.tracking.value", "read", [
                [msg.tracking_value_ids],
                { fields: ["field_desc", "old_value_char", "new_value_char", "old_value_integer", "new_value_integer", "old_value_float", "new_value_float"] },
              ]);
              if (Array.isArray(trackingData)) {
                trackingChanges = trackingData.map((tv: any) => ({
                  field: tv.field_desc || "Field",
                  old_value: String(tv.old_value_char || tv.old_value_integer || tv.old_value_float || ""),
                  new_value: String(tv.new_value_char || tv.new_value_integer || tv.new_value_float || ""),
                }));
              }
            } catch (e) {
              console.warn("Failed to fetch tracking values for msg", msg.id, e);
            }
          }

          // Skip empty notification messages (but keep if they have tracking changes)
          if (activityType === "system" && !body && !subject && !trackingChanges) continue;

          rows.push({
            lead_id: leadId,
            company_id: companyId,
            activity_type: activityType,
            title: subject || (activityType === "email" ? "Email" : activityType === "system" ? "System Update" : "Note"),
            description: body || null,
            body_html: rawHtml,
            created_by: authorName,
            created_at: msg.date ? msg.date.replace(" ", "T") + "Z" : new Date().toISOString(),
            odoo_message_id: msg.id,
            metadata: {
              odoo_subtype: Array.isArray(msg.subtype_id) ? msg.subtype_id[1] : null,
              ...(trackingChanges ? { tracking_changes: trackingChanges } : {}),
            },
          });
        }

        // Check existing odoo_message_ids to dedup
        const msgIds = rows.map(r => r.odoo_message_id);
        const existingMsgIds = new Set<number>();
        for (let k = 0; k < msgIds.length; k += 100) {
          const batch2 = msgIds.slice(k, k + 100);
          const { data: existing } = await serviceClient
            .from("lead_activities")
            .select("odoo_message_id")
            .in("odoo_message_id", batch2);
          (existing || []).forEach((e: any) => existingMsgIds.add(e.odoo_message_id));
        }

        // For re-sync: always update existing rows with body_html, description, and metadata
        const updateRows = rows.filter(r => existingMsgIds.has(r.odoo_message_id));
        for (const ur of updateRows) {
          const updates: Record<string, any> = {};
          if (ur.body_html) updates.body_html = ur.body_html;
          if (ur.description) updates.description = ur.description;
          if (ur.metadata) updates.metadata = ur.metadata;
          if (ur.created_by) updates.created_by = ur.created_by;
          if (Object.keys(updates).length > 0) {
            await serviceClient.from("lead_activities")
              .update(updates)
              .eq("odoo_message_id", ur.odoo_message_id);
          }
        }

        const newRows = rows.filter(r => !existingMsgIds.has(r.odoo_message_id));
        messagesSkipped += rows.length - newRows.length;

        // Insert in chunks of 100
        for (let j = 0; j < newRows.length; j += 100) {
          const chunk = newRows.slice(j, j + 100);
          const { error } = await serviceClient.from("lead_activities").insert(chunk);
          if (error) {
            console.error("Insert error:", error.message);
            messageErrors += chunk.length;
          } else {
            messagesInserted += chunk.length;
          }
        }
        // ── Fetch + upsert attachments from Odoo, linked to their parent message ──
        // Collect all attachment_ids from this batch of messages
        const allAttachmentIds: number[] = [];
        const attachmentToMsg = new Map<number, { msgId: number; leadId: string; msgDate: string | null }>();
        for (const msg of messages) {
          if (Array.isArray(msg.attachment_ids) && msg.attachment_ids.length > 0) {
            const leadId = odooToLead.get(msg.res_id);
            if (!leadId) continue;
            const msgDate = msg.date ? msg.date.replace(" ", "T") + "Z" : null;
            for (const aid of msg.attachment_ids) {
              const numId = Number(aid);
              allAttachmentIds.push(numId);
              attachmentToMsg.set(numId, { msgId: msg.id, leadId, msgDate });
            }
          }
        }

        // Fetch attachment metadata from Odoo in chunks
        if (allAttachmentIds.length > 0) {
          for (let ai = 0; ai < allAttachmentIds.length; ai += 100) {
            const aidBatch = allAttachmentIds.slice(ai, ai + 100);
            try {
              const attachments = await odooRpc(odooUrl, odooDB, odooKey, "ir.attachment", "read", [
                [aidBatch],
                { fields: ["id", "name", "mimetype", "file_size", "create_date", "res_id", "res_model"] },
              ]);
              if (!Array.isArray(attachments)) continue;

              for (const att of attachments) {
                const attId = Number(att.id);
                const parent = attachmentToMsg.get(attId);
                if (!parent) continue;

                const mimeType = att.mimetype || "application/octet-stream";
                const fileName = att.name || "attachment";
                const fileUrl = `${odooUrl}/web/content/${attId}?download=true`;
                const createdAt = parent.msgDate || (att.create_date ? att.create_date.replace(" ", "T") + "Z" : new Date().toISOString());

                // Upsert: if file with this odoo_id exists, update linkage; otherwise create
                const { data: existing } = await serviceClient
                  .from("lead_files")
                  .select("id, odoo_message_id")
                  .eq("odoo_id", attId)
                  .limit(1);

                if (existing && existing.length > 0) {
                  // Update linkage + timestamp if missing
                  const updates: Record<string, any> = {};
                  if (!existing[0].odoo_message_id) updates.odoo_message_id = parent.msgId;
                  if (Object.keys(updates).length > 0) {
                    updates.created_at = createdAt;
                    await serviceClient.from("lead_files").update(updates).eq("id", existing[0].id);
                  }
                } else {
                  // Create new lead_file entry
                  await serviceClient.from("lead_files").insert({
                    lead_id: parent.leadId,
                    company_id: companyId,
                    file_name: fileName,
                    file_url: fileUrl,
                    mime_type: mimeType,
                    file_size_bytes: att.file_size || null,
                    odoo_id: attId,
                    odoo_message_id: parent.msgId,
                    source: "odoo_sync",
                    created_at: createdAt,
                  });
                }
              }
            } catch (attErr) {
              console.warn("Attachment fetch error for batch:", attErr);
            }
          }
        }

        // Also try to link any pre-existing orphan files by odoo_id (integer match only)
        for (const msg of messages) {
          if (Array.isArray(msg.attachment_ids) && msg.attachment_ids.length > 0) {
            const intIds = msg.attachment_ids.map((id: any) => Number(id));
            const msgDate = msg.date ? msg.date.replace(" ", "T") + "Z" : null;
            const updatePayload: Record<string, any> = { odoo_message_id: msg.id };
            if (msgDate) updatePayload.created_at = msgDate;
            await serviceClient
              .from("lead_files")
              .update(updatePayload)
              .in("odoo_id", intIds)
              .is("odoo_message_id", null);
          }
        }

        // Re-sync: update existing activities missing metadata (tracking, body_html)
        if (mode === "full") {
          for (const msg of messages) {
            const leadId = odooToLead.get(msg.res_id);
            if (!leadId) continue;
            // Always try to update existing rows with richer data
            const { data: existing } = await serviceClient
              .from("lead_activities")
              .select("id, metadata, body_html")
              .eq("odoo_message_id", msg.id)
              .limit(1);
            if (!existing || existing.length === 0) continue;
            const meta = (existing[0].metadata as any) || {};
            const updates: Record<string, any> = {};

            // Backfill body_html if missing
            const rawHtml = (msg.body && msg.body !== false) ? String(msg.body) : null;
            if (rawHtml && !existing[0].body_html) {
              updates.body_html = rawHtml;
            }

            // Backfill tracking_changes if missing
            if ((!meta.tracking_changes || meta.tracking_changes.length === 0) &&
                Array.isArray(msg.tracking_value_ids) && msg.tracking_value_ids.length > 0) {
              try {
                const trackingData = await odooRpc(odooUrl, odooDB, odooKey, "mail.tracking.value", "read", [
                  [msg.tracking_value_ids],
                  { fields: ["field_desc", "old_value_char", "new_value_char", "old_value_integer", "new_value_integer", "old_value_float", "new_value_float"] },
                ]);
                if (Array.isArray(trackingData) && trackingData.length > 0) {
                  const trackingChanges = trackingData.map((tv: any) => ({
                    field: tv.field_desc || "Field",
                    old_value: String(tv.old_value_char || tv.old_value_integer || tv.old_value_float || ""),
                    new_value: String(tv.new_value_char || tv.new_value_integer || tv.new_value_float || ""),
                  }));
                  updates.metadata = { ...meta, tracking_changes: trackingChanges };
                }
              } catch (e) {
                console.warn("Failed to backfill tracking for msg", msg.id, e);
              }
            }

            if (Object.keys(updates).length > 0) {
              await serviceClient.from("lead_activities")
                .update(updates)
                .eq("id", existing[0].id);
            }
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

        // Upsert with ignoreDuplicates — unique index on (entity_id, activity_type, summary, due_date)
        for (let j = 0; j < rows.length; j += 100) {
          const chunk = rows.slice(j, j + 100);
          const { error } = await serviceClient.from("scheduled_activities")
            .upsert(chunk, { onConflict: "entity_id,activity_type,summary,due_date", ignoreDuplicates: true });
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

    // Count file linkage stats
    const { count: filesLinked } = await serviceClient
      .from("lead_files")
      .select("id", { count: "exact", head: true })
      .not("odoo_message_id", "is", null);
    const { count: filesUnlinked } = await serviceClient
      .from("lead_files")
      .select("id", { count: "exact", head: true })
      .is("odoo_message_id", null)
      .eq("source", "odoo_sync");

    return json({
      mode,
      leads_processed: targetLeads.length,
      messages_inserted: messagesInserted,
      messages_skipped: messagesSkipped,
      message_errors: messageErrors,
      activities_inserted: activitiesInserted,
      activity_errors: activityErrors,
      files_linked: filesLinked || 0,
      files_unlinked_remaining: filesUnlinked || 0,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Chatter sync error:", err);
    return json({ error: err.message || "Chatter sync failed" }, 500);
  }
});
