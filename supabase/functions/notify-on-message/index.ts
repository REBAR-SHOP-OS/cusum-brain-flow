import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { groupByLanguage, translateNotification } from "../_shared/notifyTranslate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  try {
    const { type, table, record } = await req.json();
    if (type !== "INSERT" || !record) {
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;
    const pushHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` };

    if (table === "team_messages") {
      await handleTeamMessage(svc, record, sendPushUrl, pushHeaders, supabaseUrl, anonKey);
    } else if (table === "support_messages") {
      await handleSupportMessage(svc, record, sendPushUrl, pushHeaders, supabaseUrl, anonKey);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("notify-on-message error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleTeamMessage(
  svc: any,
  record: any,
  sendPushUrl: string,
  pushHeaders: Record<string, string>,
  supabaseUrl: string,
  anonKey: string
) {
  const { channel_id, sender_profile_id, original_text } = record;

  // Get channel name
  const { data: channel } = await svc
    .from("team_channels")
    .select("name")
    .eq("id", channel_id)
    .single();

  const channelName = channel?.name || "a channel";

  // Get sender name
  const { data: senderProfile } = await svc
    .from("profiles")
    .select("full_name, user_id")
    .eq("id", sender_profile_id)
    .single();

  const senderName = senderProfile?.full_name || "Someone";

  // Get all channel members except sender
  const { data: members } = await svc
    .from("team_channel_members")
    .select("profile_id")
    .eq("channel_id", channel_id)
    .neq("profile_id", sender_profile_id);

  if (!members || members.length === 0) return;

  // Map profile_ids to user_ids + preferred_language
  const profileIds = members.map((m: any) => m.profile_id);
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, user_id, preferred_language")
    .in("id", profileIds);

  if (!profiles || profiles.length === 0) return;

  const preview = (original_text || "").slice(0, 120);
  const titleEn = `${senderName} in #${channelName}`;

  // Group by language and translate once per language group
  const byLang = groupByLanguage(profiles);

  const notifRows: any[] = [];
  const pushPromises: Promise<any>[] = [];

  for (const [lang, langProfiles] of Object.entries(byLang)) {
    const { title: localTitle, body: localBody } = await translateNotification(
      supabaseUrl, anonKey, titleEn, preview, lang
    );

    for (const p of langProfiles) {
      notifRows.push({
        user_id: p.user_id,
        type: "notification",
        title: localTitle,
        description: localBody,
        link_to: "/team-hub",
        agent_name: "Team Chat",
        priority: "normal",
        metadata: { channel_id, sender_profile_id },
      });

      pushPromises.push(
        fetch(sendPushUrl, {
          method: "POST",
          headers: pushHeaders,
          body: JSON.stringify({
            user_id: p.user_id,
            title: localTitle,
            body: localBody,
            linkTo: "/team-hub",
            tag: `team-${channel_id}`,
          }),
        }).catch(() => {})
      );
    }
  }

  if (notifRows.length > 0) {
    try {
      await svc.from("notifications").insert(notifRows);
    } catch (err) {
      console.error("Failed to insert team notifications:", err);
    }
  }

  await Promise.allSettled(pushPromises);
}

async function handleSupportMessage(
  svc: any,
  record: any,
  sendPushUrl: string,
  pushHeaders: Record<string, string>,
  supabaseUrl: string,
  anonKey: string
) {
  // Only notify for visitor messages
  if (record.sender_type !== "visitor") return;
  // Skip internal notes and system messages
  if (record.is_internal_note || record.content_type === "system") return;

  const { conversation_id, content } = record;

  // Get conversation details
  const { data: convo } = await svc
    .from("support_conversations")
    .select("visitor_name, company_id")
    .eq("id", conversation_id)
    .single();

  const visitorName = convo?.visitor_name || "A visitor";
  const companyId = convo?.company_id;
  const preview = (content || "").slice(0, 120);
  const titleEn = `Support: ${visitorName}`;

  // Get all admin/office users for this company
  const { data: roleUsers } = await svc
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "office"]);

  if (!roleUsers || roleUsers.length === 0) return;

  // Filter to users in the same company — include preferred_language
  const userIds = roleUsers.map((r: any) => r.user_id);
  const { data: companyProfiles } = await svc
    .from("profiles")
    .select("user_id, preferred_language")
    .in("user_id", userIds)
    .eq("company_id", companyId);

  if (!companyProfiles || companyProfiles.length === 0) return;

  // Group by language and translate once per language group
  const byLang = groupByLanguage(companyProfiles);

  const notifRows: any[] = [];
  const pushPromises: Promise<any>[] = [];

  for (const [lang, langProfiles] of Object.entries(byLang)) {
    const { title: localTitle, body: localBody } = await translateNotification(
      supabaseUrl, anonKey, titleEn, preview, lang
    );

    for (const p of langProfiles) {
      notifRows.push({
        user_id: p.user_id,
        type: "notification",
        title: localTitle,
        description: localBody,
        link_to: "/support-inbox",
        agent_name: "Support",
        priority: "high",
        metadata: { conversation_id },
      });

      pushPromises.push(
        fetch(sendPushUrl, {
          method: "POST",
          headers: pushHeaders,
          body: JSON.stringify({
            user_id: p.user_id,
            title: localTitle,
            body: localBody,
            linkTo: "/support-inbox",
            tag: `support-${conversation_id}`,
          }),
        }).catch(() => {})
      );
    }
  }

  if (notifRows.length > 0) {
    try {
      await svc.from("notifications").insert(notifRows);
    } catch (err) {
      console.error("Failed to insert support notifications:", err);
    }
  }

  await Promise.allSettled(pushPromises);
}
