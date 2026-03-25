import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

interface AlertPayload {
  company_id: string;
  category: string;
  type?: string;
  severity?: string;
  title: string;
  message?: string;
  link_to?: string;
  metadata?: Record<string, unknown>;
  agent_name?: string;
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    const payload = body as AlertPayload;
    const {
      company_id,
      category,
      type,
      severity,
      title,
      message,
      link_to,
      metadata,
      agent_name,
    } = payload;

    if (!company_id || !category || !title) {
      return new Response(
        JSON.stringify({ error: "company_id, category, and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: rules, error: rulesErr } = await serviceClient
      .from("alert_routing_rules")
      .select("*")
      .eq("company_id", company_id)
      .eq("event_category", category)
      .eq("enabled", true);

    if (rulesErr) throw rulesErr;

    const matched = (rules || []).filter(
      (r: any) => r.event_type === null || r.event_type === type
    );

    if (matched.length === 0) {
      console.log(`No routing rules for ${category}/${type} in company ${company_id}`);
      return { ok: true, matched: 0, dispatched: 0 };
    }

    let totalDispatched = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const rule of matched) {
      const effectivePriority = severity || rule.priority || "normal";
      const targetRoles: string[] = rule.target_roles || [];
      const channels: string[] = rule.channels || ["in_app"];

      if (targetRoles.length === 0) continue;

      const { data: targetUsers, error: usersErr } = await serviceClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", targetRoles);

      if (usersErr) {
        console.error("Error fetching target users:", usersErr);
        continue;
      }

      const userIds = [...new Set((targetUsers || []).map((u: any) => u.user_id))];
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("user_id, email, phone_number, full_name")
        .eq("company_id", company_id)
        .in("user_id", userIds);

      const companyUsers = profiles || [];
      if (companyUsers.length === 0) continue;

      for (const user of companyUsers) {
        for (const channel of channels) {
          try {
            await dispatchAlert(serviceClient, supabaseUrl, serviceKey, {
              channel,
              company_id,
              user,
              title,
              message: message || "",
              link_to: link_to || null,
              priority: effectivePriority,
              metadata: {
                ...metadata,
                event_category: category,
                event_type: type,
                rule_id: rule.id,
              },
              agent_name: agent_name || categoryToAgent(category),
              notification_id: null,
              rule,
            });
            totalDispatched++;
          } catch (err) {
            console.error(`Dispatch failed [${channel}] to ${user.email}:`, err);
            await serviceClient.from("alert_dispatch_log").insert({
              company_id,
              channel,
              recipient_user_id: user.user_id,
              recipient_address: user.email || "",
              status: "failed",
              error_message: err instanceof Error ? err.message : String(err),
              metadata: { category, type, rule_id: rule.id },
            });
          }
        }
      }
    }

    return { ok: true, matched: matched.length, dispatched: totalDispatched };
  }, { functionName: "alert-router", requireCompany: false, wrapResult: false })
);

function categoryToAgent(category: string): string {
  const map: Record<string, string> = {
    finance: "Penny",
    sales: "Sales",
    production: "Forge",
    support: "Support",
    hr: "HR",
    system: "Vizzy",
  };
  return map[category] || "System";
}

interface DispatchContext {
  channel: string;
  company_id: string;
  user: { user_id: string; email: string | null; phone_number: string | null; full_name: string | null };
  title: string;
  message: string;
  link_to: string | null;
  priority: string;
  metadata: Record<string, unknown>;
  agent_name: string;
  notification_id: string | null;
  rule: any;
}

async function dispatchAlert(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  ctx: DispatchContext
) {
  const { channel, company_id, user, title, message, link_to, priority, metadata, agent_name, rule } = ctx;

  if (channel === "in_app") {
    const { data: notif, error } = await supabase.from("notifications").insert({
      user_id: user.user_id,
      type: "notification",
      title,
      description: message,
      link_to,
      priority: priority === "critical" ? "high" : priority,
      agent_name,
      status: "unread",
      metadata,
    }).select("id").single();

    if (error) throw error;

    await supabase.from("alert_dispatch_log").insert({
      company_id,
      notification_id: notif.id,
      channel: "in_app",
      recipient_user_id: user.user_id,
      recipient_address: user.email || user.user_id,
      status: "delivered",
    });

    if (rule.escalate_to_role) {
      const escalateAt = new Date(Date.now() + (rule.escalate_after_minutes || 60) * 60000);
      await supabase.from("alert_escalation_queue").insert({
        company_id,
        notification_id: notif.id,
        rule_id: rule.id,
        escalation_level: 0,
        escalate_at: escalateAt.toISOString(),
        status: "pending",
      });
    }
  } else if (channel === "email") {
    if (!user.email) return;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: user.email,
          subject: `[${priority.toUpperCase()}] ${title}`,
          body: formatEmailBody(title, message, link_to, priority),
        }),
      });
      const result = await resp.json();
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "email",
        recipient_user_id: user.user_id,
        recipient_address: user.email,
        status: resp.ok ? "sent" : "failed",
        error_message: resp.ok ? null : JSON.stringify(result),
        metadata: { rule_id: rule.id },
      });
    } catch (err) {
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "email",
        recipient_user_id: user.user_id,
        recipient_address: user.email || "",
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (channel === "sms") {
    const phone = user.phone_number;
    if (!phone) return;

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!twilioSid || !twilioAuth || !twilioFrom) {
      console.warn("Twilio not configured, skipping SMS");
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "sms",
        recipient_user_id: user.user_id,
        recipient_address: phone,
        status: "failed",
        error_message: "Twilio credentials not configured",
      });
      return;
    }

    try {
      const smsBody = `[${priority.toUpperCase()}] ${title}\n${message}`.slice(0, 1600);
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
          },
          body: new URLSearchParams({
            To: phone,
            From: twilioFrom,
            Body: smsBody,
          }),
        }
      );
      const result = await resp.json();
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "sms",
        recipient_user_id: user.user_id,
        recipient_address: phone,
        status: resp.ok ? "sent" : "failed",
        error_message: resp.ok ? null : JSON.stringify(result),
      });
    } catch (err) {
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "sms",
        recipient_user_id: user.user_id,
        recipient_address: phone,
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (channel === "slack") {
    const slackApiKey = Deno.env.get("SLACK_API_KEY");
    const slackChannel = rule.slack_channel || "#alerts";

    if (!slackApiKey) {
      console.warn("Slack not configured, skipping");
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "slack",
        recipient_user_id: user.user_id,
        recipient_address: slackChannel,
        status: "failed",
        error_message: "Slack connector not configured",
      });
      return;
    }

    try {
      const priorityEmoji = priority === "critical" ? "🔴" : priority === "high" ? "🟠" : "🔵";
      const text = `${priorityEmoji} *${title}*\n${message}${link_to ? `\n<${link_to}|View Details>` : ""}`;

      const resp = await fetch(`https://slack.com/api/chat.postMessage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${slackApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: slackChannel,
          text,
          username: `${agent_name} Alert`,
        }),
      });
      const result = await resp.json();
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "slack",
        recipient_user_id: user.user_id,
        recipient_address: slackChannel,
        status: resp.ok && result.ok ? "sent" : "failed",
        error_message: resp.ok && result.ok ? null : JSON.stringify(result),
      });
    } catch (err) {
      await supabase.from("alert_dispatch_log").insert({
        company_id,
        channel: "slack",
        recipient_user_id: user.user_id,
        recipient_address: slackChannel,
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function formatEmailBody(
  title: string,
  message: string,
  linkTo: string | null,
  priority: string
): string {
  const color = priority === "critical" ? "#dc2626" : priority === "high" ? "#f59e0b" : "#3b82f6";
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:${color};color:white;padding:12px 20px;border-radius:8px 8px 0 0">
    <strong>[${priority.toUpperCase()}] Alert</strong>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 12px">${title}</h2>
    <p style="color:#4b5563">${message}</p>
    ${linkTo ? `<a href="${linkTo}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:${color};color:white;text-decoration:none;border-radius:6px">View Details</a>` : ""}
  </div>
</div>`;
}
