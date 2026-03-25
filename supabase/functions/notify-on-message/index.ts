import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: svc, body } = ctx;
    const { type, table, record } = body;

    if (type !== "INSERT" || !record) {
      return { skipped: true };
    }

    if (table === "team_messages") {
      await handleTeamMessage(svc, record);
    } else if (table === "support_messages") {
      await handleSupportMessage(svc, record);
    }

    return { ok: true };
  }, { functionName: "notify-on-message", authMode: "none", requireCompany: false, wrapResult: false })
);

async function handleTeamMessage(svc: any, record: any) {
  const { channel_id, sender_profile_id, original_text } = record;

  const { data: channel } = await svc
    .from("team_channels")
    .select("name, channel_type")
    .eq("id", channel_id)
    .single();

  const channelName = channel?.name || "a channel";
  const channelType = channel?.channel_type;

  const { data: senderProfile } = await svc
    .from("profiles")
    .select("full_name, user_id")
    .eq("id", sender_profile_id)
    .single();

  const senderName = senderProfile?.full_name || "Someone";

  let profiles: any[] | null = null;

  if (channelName === "Official Channel" || channelName === "Official Group") {
    const { data } = await svc
      .from("profiles")
      .select("id, user_id, preferred_language, email")
      .like("email", "%@rebar.shop")
      .neq("id", sender_profile_id);
    profiles = data;
  } else {
    const { data: members } = await svc
      .from("team_channel_members")
      .select("profile_id")
      .eq("channel_id", channel_id)
      .neq("profile_id", sender_profile_id);

    if (!members || members.length === 0) return;

    const profileIds = members.map((m: any) => m.profile_id);
    const { data } = await svc
      .from("profiles")
      .select("id, user_id, preferred_language")
      .in("id", profileIds);
    profiles = data;
  }

  if (!profiles || profiles.length === 0) return;

  const preview = (original_text || "").slice(0, 120);
  const titleEn = channelType === "dm" ? senderName : `${senderName} in #${channelName}`;

  const notifRows: any[] = [];

  for (const p of profiles) {
    notifRows.push({
      user_id: p.user_id,
      type: "notification",
      title: titleEn,
      description: preview,
      link_to: "/team-hub",
      agent_name: "Team Chat",
      priority: "normal",
      metadata: { channel_id, sender_profile_id },
    });
  }

  if (notifRows.length > 0) {
    try {
      await svc.from("notifications").insert(notifRows);
    } catch (err) {
      console.error("Failed to insert team notifications:", err);
    }
  }
}

async function handleSupportMessage(svc: any, record: any) {
  if (record.sender_type !== "visitor") return;
  if (record.is_internal_note || record.content_type === "system") return;

  const { conversation_id, content } = record;

  const { data: convo } = await svc
    .from("support_conversations")
    .select("visitor_name, company_id")
    .eq("id", conversation_id)
    .single();

  const visitorName = convo?.visitor_name || "A visitor";
  const companyId = convo?.company_id;
  const preview = (content || "").slice(0, 120);
  const titleEn = `Support: ${visitorName}`;

  const { data: roleUsers } = await svc
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "office"]);

  if (!roleUsers || roleUsers.length === 0) return;

  const userIds = roleUsers.map((r: any) => r.user_id);
  const { data: companyProfiles } = await svc
    .from("profiles")
    .select("user_id, preferred_language")
    .in("user_id", userIds)
    .eq("company_id", companyId);

  if (!companyProfiles || companyProfiles.length === 0) return;

  const notifRows: any[] = [];

  for (const p of companyProfiles) {
    notifRows.push({
      user_id: p.user_id,
      type: "notification",
      title: titleEn,
      description: preview,
      link_to: "/support-inbox",
      agent_name: "Support",
      priority: "high",
      metadata: { conversation_id },
    });
  }

  if (notifRows.length > 0) {
    try {
      await svc.from("notifications").insert(notifRows);
    } catch (err) {
      console.error("Failed to insert support notifications:", err);
    }
  }
}
