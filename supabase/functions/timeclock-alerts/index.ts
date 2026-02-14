import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine check type from body or default based on current hour
    let checkType: "missed_clockin" | "missed_clockout" = "missed_clockin";
    try {
      const body = await req.json();
      if (body?.check_type) checkType = body.check_type;
    } catch { /* no body, use default */ }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const startOfDay = `${todayStr}T00:00:00.000Z`;
    const endOfDay = `${todayStr}T23:59:59.999Z`;

    // Get all active employees
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, company_id")
      .eq("is_active", true);

    if (profilesErr) throw profilesErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active profiles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get today's time clock entries
    const { data: entries, error: entriesErr } = await supabase
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out")
      .gte("clock_in", startOfDay)
      .lte("clock_in", endOfDay);

    if (entriesErr) throw entriesErr;

    const entriesByProfile = new Map<string, typeof entries>();
    for (const e of entries || []) {
      const list = entriesByProfile.get(e.profile_id) || [];
      list.push(e);
      entriesByProfile.set(e.profile_id, list);
    }

    // Check existing notifications for dedup
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("metadata")
      .eq("type", "notification")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    const dedupSet = new Set<string>();
    for (const n of existingNotifs || []) {
      const m = n.metadata as Record<string, unknown> | null;
      if (m?.dedupe_key) dedupSet.add(m.dedupe_key as string);
    }

    const alerts: Array<{ profileId: string; userId: string; name: string; email: string; alertType: string; companyId: string }> = [];

    if (checkType === "missed_clockin") {
      // Employees with NO entry today
      for (const p of profiles) {
        if (!entriesByProfile.has(p.id)) {
          const key = `${todayStr}:${p.id}:missed_clockin`;
          if (!dedupSet.has(key)) {
            alerts.push({ profileId: p.id, userId: p.user_id, name: p.full_name, email: p.email, alertType: "missed_clockin", companyId: p.company_id });
          }
        }
      }
    } else {
      // Employees with open clock_out
      for (const p of profiles) {
        const pEntries = entriesByProfile.get(p.id);
        if (pEntries) {
          const hasOpen = pEntries.some((e: any) => !e.clock_out);
          if (hasOpen) {
            const key = `${todayStr}:${p.id}:missed_clockout`;
            if (!dedupSet.has(key)) {
              alerts.push({ profileId: p.id, userId: p.user_id, name: p.full_name, email: p.email, alertType: "missed_clockout", companyId: p.company_id });
            }
          }
        }
      }
    }

    // Process alerts
    let notifCount = 0;
    let emailCount = 0;

    for (const alert of alerts) {
      const dedupeKey = `${todayStr}:${alert.profileId}:${alert.alertType}`;
      const title = alert.alertType === "missed_clockin"
        ? `⏰ ${alert.name} hasn't clocked in today`
        : `⏰ ${alert.name} hasn't clocked out`;
      const description = alert.alertType === "missed_clockin"
        ? `${alert.name} has not signed in for ${todayStr}. Please follow up.`
        : `${alert.name} clocked in but hasn't clocked out yet for ${todayStr}.`;

      // Insert notification for the employee (only if they have a linked auth user)
      if (alert.userId) {
        await supabase.from("notifications").insert({
          user_id: alert.userId,
          type: "notification",
          title,
          description,
          agent_name: "Forge",
          agent_color: "bg-orange-500",
          status: "unread",
          priority: "high",
          link_to: "/timeclock",
          assigned_to: alert.userId,
          metadata: { date: todayStr, profile_id: alert.profileId, alert_type: alert.alertType, dedupe_key: dedupeKey },
        });
        notifCount++;
      }

      // Notify admins in the same company (single query instead of N+1)
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminUsers) {
        // Filter to admins in the same company
        const { data: companyAdmins } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("company_id", alert.companyId)
          .eq("is_active", true)
          .in("user_id", adminUsers.map((a) => a.user_id));

        for (const admin of companyAdmins || []) {
          const adminDedupeKey = `${dedupeKey}:admin:${admin.user_id}`;
          if (!dedupSet.has(adminDedupeKey)) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              type: "notification",
              title,
              description,
              agent_name: "Forge",
              agent_color: "bg-orange-500",
              status: "unread",
              priority: "high",
              link_to: "/timeclock",
              metadata: { date: todayStr, profile_id: alert.profileId, alert_type: alert.alertType, dedupe_key: adminDedupeKey },
            });
            notifCount++;
          }
        }
      }

      // Send email to the employee
      if (alert.email) {
        try {
          const emailBody = `
            <h2 style="color:#ea580c;">Attendance Alert</h2>
            <p>${description}</p>
            <p>Please <a href="https://cusum-brain-flow.lovable.app/timeclock">go to Time Clock</a> to ${alert.alertType === "missed_clockin" ? "clock in" : "clock out"}.</p>
            <p style="color:#888;font-size:12px;">This is an automated alert from Forge.</p>
          `;

          await sendAlertEmail(alert.email, title, emailBody);
          emailCount++;
        } catch (emailErr) {
          console.error("Failed to send alert email to", alert.email, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, check_type: checkType, alerts_created: notifCount, emails_sent: emailCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("timeclock-alerts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendAlertEmail(to: string, subject: string, body: string) {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn("Gmail credentials not configured, skipping email");
    return;
  }

  // Get access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();

  // Get sender email
  const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = await profileRes.json();

  // Build raw email
  const emailLines = [
    `From: ${profile.emailAddress}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ];

  const raw = btoa(unescape(encodeURIComponent(emailLines.join("\r\n"))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
}
