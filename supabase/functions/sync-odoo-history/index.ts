import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIME_LIMIT_MS = 50_000;

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
  if (!uidMatch) throw new Error(`Odoo auth failed: ${text.slice(0, 300)}`);
  return { uid: parseInt(uidMatch[1]), url };
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
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: Date.now(),
      params: {
        service: "object", method: "execute_kw",
        args: [db, session.uid, apiKey, model, "search_read", [domain], { fields, limit: limit || false, offset }],
      },
    }),
  });

  if (!res.ok) throw new Error(`Odoo ${model} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Odoo ${model} error: ${JSON.stringify(json.error)}`);
  return json.result || [];
}

// Strip HTML tags for plain text display
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", user.id).single();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = profile.company_id;
    const session = await odooAuthenticate();

    // Load lead → odoo_id mapping from DB
    const leadMap = new Map<number, string>(); // odoo_id → lead uuid
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, source_email_id")
        .like("source_email_id", "odoo_crm_%")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const odooId = parseInt(r.source_email_id.replace("odoo_crm_", ""));
        if (!isNaN(odooId)) leadMap.set(odooId, r.id);
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    console.log(`Loaded ${leadMap.size} lead mappings`);

    // Load existing odoo_message_ids to skip duplicates
    const existingMsgIds = new Set<number>();
    from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("lead_activities")
        .select("odoo_message_id")
        .not("odoo_message_id", "is", null)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) if (r.odoo_message_id) existingMsgIds.add(r.odoo_message_id);
      if (data.length < 1000) break;
      from += 1000;
    }

    // Load existing file odoo_ids to skip duplicates
    const existingFileIds = new Set<number>();
    from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("lead_files")
        .select("odoo_id")
        .not("odoo_id", "is", null)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) if (r.odoo_id) existingFileIds.add(r.odoo_id);
      if (data.length < 1000) break;
      from += 1000;
    }

    console.log(`Existing: ${existingMsgIds.size} messages, ${existingFileIds.size} files`);

    let messagesAdded = 0, filesAdded = 0, leadsProcessed = 0;
    let remaining = false;
    const odooIds = Array.from(leadMap.keys());

    // Process in batches of 50 leads at a time
    const BATCH = 50;
    for (let b = 0; b < odooIds.length; b += BATCH) {
      if (Date.now() - startTime > TIME_LIMIT_MS) { remaining = true; break; }

      const batchIds = odooIds.slice(b, b + BATCH);

      // 1. Fetch chatter messages for this batch of leads
      const messages = await odooSearchRead(session, "mail.message", [
        "id", "res_id", "body", "date", "author_id", "message_type", "subtype_id",
        "subject", "email_from", "tracking_value_ids",
      ], [
        ["model", "=", "crm.lead"],
        ["res_id", "in", batchIds],
      ], 0, 0) as Array<Record<string, unknown>>;

      // Process messages
      const activityInserts: unknown[] = [];
      for (const msg of messages) {
        const msgId = msg.id as number;
        if (existingMsgIds.has(msgId)) continue;

        const resId = msg.res_id as number;
        const leadId = leadMap.get(resId);
        if (!leadId) continue;

        const body = (msg.body as string) || "";
        const plainBody = stripHtml(body);
        const authorArr = msg.author_id as [number, string] | false;
        const authorName = authorArr ? authorArr[1] : "System";
        const msgType = (msg.message_type as string) || "notification";
        const date = (msg.date as string) || null;
        const subject = (msg.subject as string) || null;

        // Map Odoo message types
        let activityType = "note";
        if (msgType === "email") activityType = "email";
        else if (msgType === "comment") activityType = "comment";
        else if (msgType === "notification") activityType = "system";

        // Check for tracking values (stage changes)
        const trackingIds = msg.tracking_value_ids as number[] | false;
        if (trackingIds && trackingIds.length > 0 && !plainBody) {
          activityType = "stage_change";
        }

        const title = subject || (activityType === "email" ? "Email" :
          activityType === "stage_change" ? "Stage Changed" :
          activityType === "system" ? "System Update" : "Note");

        activityInserts.push({
          lead_id: leadId,
          company_id: companyId,
          activity_type: activityType,
          title,
          description: plainBody.substring(0, 2000) || title,
          created_by: authorName,
          created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          odoo_message_id: msgId,
          metadata: {
            odoo_msg_type: msgType,
            odoo_author: authorName,
            email_from: msg.email_from || null,
            has_tracking: !!(trackingIds && trackingIds.length > 0),
            body_html: body.substring(0, 5000),
          },
        });

        existingMsgIds.add(msgId);
      }

      // Batch insert activities
      for (let i = 0; i < activityInserts.length; i += 50) {
        const chunk = activityInserts.slice(i, i + 50);
        const { error } = await supabaseAdmin.from("lead_activities").insert(chunk);
        if (error) {
          console.error("Activity insert error:", error.message);
          // Fallback individual inserts
          for (const item of chunk) {
            const { error: sErr } = await supabaseAdmin.from("lead_activities").insert(item);
            if (!sErr) messagesAdded++;
          }
        } else {
          messagesAdded += chunk.length;
        }
      }

      // 2. Fetch attachments for this batch
      const attachments = await odooSearchRead(session, "ir.attachment", [
        "id", "res_id", "name", "mimetype", "file_size", "create_date", "type", "url",
      ], [
        ["res_model", "=", "crm.lead"],
        ["res_id", "in", batchIds],
      ], 0, 0) as Array<Record<string, unknown>>;

      const fileInserts: unknown[] = [];
      for (const att of attachments) {
        const attId = att.id as number;
        if (existingFileIds.has(attId)) continue;

        const resId = att.res_id as number;
        const leadId = leadMap.get(resId);
        if (!leadId) continue;

        const fileName = (att.name as string) || "Unnamed";
        const mimeType = (att.mimetype as string) || null;
        const fileSize = (att.file_size as number) || null;
        const attType = (att.type as string) || "binary";
        const attUrl = (att.url as string) || null;

        // Build a download URL for binary attachments from Odoo
        const fileUrl = attType === "url" ? attUrl :
          `${session.url}/web/content/${attId}?download=true`;

        fileInserts.push({
          lead_id: leadId,
          company_id: companyId,
          file_name: fileName,
          file_url: fileUrl,
          file_size_bytes: fileSize,
          mime_type: mimeType,
          odoo_id: attId,
          source: "odoo_sync",
        });

        existingFileIds.add(attId);
      }

      // Batch insert files
      for (let i = 0; i < fileInserts.length; i += 50) {
        const chunk = fileInserts.slice(i, i + 50);
        const { error } = await supabaseAdmin.from("lead_files").insert(chunk);
        if (error) {
          console.error("File insert error:", error.message);
          for (const item of chunk) {
            const { error: sErr } = await supabaseAdmin.from("lead_files").insert(item);
            if (!sErr) filesAdded++;
          }
        } else {
          filesAdded += chunk.length;
        }
      }

      leadsProcessed += batchIds.length;
      if (b % 200 === 0) {
        console.log(`Progress: ${leadsProcessed}/${odooIds.length} leads, ${messagesAdded} msgs, ${filesAdded} files`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`History sync done in ${elapsed}s: ${messagesAdded} messages, ${filesAdded} files, ${leadsProcessed} leads`);

    return new Response(
      JSON.stringify({
        messages_added: messagesAdded,
        files_added: filesAdded,
        leads_processed: leadsProcessed,
        total_leads: odooIds.length,
        remaining,
        elapsed_s: parseFloat(elapsed),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-odoo-history error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
