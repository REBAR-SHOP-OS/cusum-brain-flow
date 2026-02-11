import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

const TEAM_DIR: Record<string, { name: string; role: string }> = {
  "sattar@rebar.shop": { name: "Sattar Esmaeili", role: "CEO" },
  "neel@rebar.shop": { name: "Neel Mahajan", role: "Co-founder" },
  "vicky@rebar.shop": { name: "Vicky Anderson", role: "Accountant" },
  "saurabh@rebar.shop": { name: "Saurabh Seghal", role: "Sales" },
  "ben@rebar.shop": { name: "Ben Rajabifar", role: "Estimator" },
  "kourosh@rebar.shop": { name: "Kourosh Zand", role: "Shop Supervisor" },
  "radin@rebar.shop": { name: "Radin Lachini", role: "AI Manager" },
  "ai@rebar.shop": { name: "AI Supervisor", role: "Shared Mailbox" },
};

const SUPERVISOR_EMAIL = "ai@rebar.shop";

interface PersonActivity {
  name: string;
  role: string;
  email: string;
  emailsSent: { subject: string; to: string; preview: string }[];
  emailsReceived: { subject: string; from: string; preview: string }[];
  tasksOpen: number;
  tasksDone: number;
  agentSessions: number;
  aiSummary: string;
}

function todayISOString(dateOverride?: string): string {
  if (dateOverride) return dateOverride;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function matchEmail(field: string | null, targetEmail: string): boolean {
  if (!field) return false;
  return field.toLowerCase().includes(targetEmail.toLowerCase());
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// Get Gmail access token for ai@rebar.shop
async function getSupervisorAccessToken(serviceClient: ReturnType<typeof createClient>): Promise<string> {
  // Find the user_id for ai@rebar.shop
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("user_id")
    .eq("email", SUPERVISOR_EMAIL)
    .maybeSingle();

  if (!profile?.user_id) throw new Error("ai@rebar.shop profile not found");

  const { data: tokenRow } = await serviceClient
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;
  if (refreshToken && tokenRow?.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }
  if (!refreshToken) {
    const shared = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (shared) refreshToken = shared;
  }
  if (!refreshToken) throw new Error("No Gmail token for ai@rebar.shop");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  const data = await resp.json();

  // Rotate if needed
  if (data.refresh_token) {
    const { encryptToken } = await import("../_shared/tokenEncryption.ts");
    const enc = await encryptToken(data.refresh_token);
    await serviceClient
      .from("user_gmail_tokens")
      .update({ refresh_token: enc, is_encrypted: true, token_rotated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id);
  }

  return data.access_token;
}

function createRawEmail(to: string, subject: string, body: string, fromEmail: string): string {
  const lines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ];
  const raw = lines.join("\r\n");
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(accessToken: string, to: string, subject: string, htmlBody: string) {
  const profileResp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileResp.ok) throw new Error("Failed to get Gmail profile");
  const profile = await profileResp.json();
  const fromEmail = profile.emailAddress;

  const raw = createRawEmail(to, subject, htmlBody, fromEmail);
  const sendResp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!sendResp.ok) {
    const err = await sendResp.text();
    console.error(`Failed to send to ${to}:`, err);
    return false;
  }
  await sendResp.json();
  return true;
}

async function aiSummarize(personData: PersonActivity): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "AI summary unavailable.";

  const emailList = [
    ...personData.emailsSent.map(e => `SENT to ${e.to}: "${e.subject}" — ${e.preview}`),
    ...personData.emailsReceived.map(e => `RECEIVED from ${e.from}: "${e.subject}" — ${e.preview}`),
  ].join("\n");

  const prompt = `You are a concise business analyst. Summarize this person's email activity for today.
Extract: 1) Key notes (max 5 bullet points) 2) Action items they need to follow up on (max 5)
Keep it short and actionable. No fluff.

Person: ${personData.name} (${personData.role})
Tasks: ${personData.tasksOpen} open, ${personData.tasksDone} completed
Agent Sessions: ${personData.agentSessions}

Emails:
${emailList || "No email activity today."}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a concise business analyst extracting key notes and action items from daily email activity." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      console.warn("AI summarize failed:", resp.status);
      return "AI summary unavailable (API error).";
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "No summary generated.";
  } catch (e) {
    console.warn("AI summarize error:", e);
    return "AI summary unavailable.";
  }
}

function buildPersonalReportHTML(person: PersonActivity, dateStr: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:24px 32px;color:#fff;">
    <h1 style="margin:0;font-size:20px;">Daily Activity Report</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${person.name} — ${dateStr}</p>
  </div>
  <div style="padding:24px 32px;">
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;">📧 Emails</h2>
    <p style="font-size:14px;color:#555;">Sent: <strong>${person.emailsSent.length}</strong> | Received: <strong>${person.emailsReceived.length}</strong></p>
    
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;">📋 Tasks</h2>
    <p style="font-size:14px;color:#555;">Open: <strong>${person.tasksOpen}</strong> | Completed today: <strong>${person.tasksDone}</strong></p>
    
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;">🤖 AI Agent Sessions</h2>
    <p style="font-size:14px;color:#555;">${person.agentSessions} session(s)</p>
    
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;">🧠 AI Summary & Action Items</h2>
    <div style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;background:#f8f9fa;padding:16px;border-radius:6px;">${person.aiSummary}</div>
  </div>
  <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:12px;color:#888;">
    Rebar.shop AI Supervisor — Automated Report
  </div>
</div></body></html>`;
}

function buildMasterReportHTML(people: PersonActivity[], dateStr: string): string {
  const rows = people.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;"><strong>${p.name}</strong><br><span style="color:#888;font-size:12px;">${p.role}</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.emailsSent.length}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.emailsReceived.length}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.tasksOpen}/${p.tasksDone}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.agentSessions}</td>
    </tr>`).join("");

  const summaries = people.map(p => `
    <div style="margin-bottom:20px;">
      <h3 style="font-size:15px;color:#1a1a2e;margin:0 0 8px;">${p.name} (${p.role})</h3>
      <div style="font-size:13px;color:#333;line-height:1.5;white-space:pre-wrap;background:#f8f9fa;padding:12px;border-radius:6px;">${p.aiSummary}</div>
    </div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:24px 32px;color:#fff;">
    <h1 style="margin:0;font-size:20px;">📊 Master Supervisory Report</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${dateStr} — All Team Activity</p>
  </div>
  <div style="padding:24px 32px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f0f0f5;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;">Person</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Sent</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Received</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Tasks (Open/Done)</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">AI Sessions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;margin-top:24px;">Per-Person Summaries</h2>
    ${summaries}
  </div>
  <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:12px;color:#888;">
    Rebar.shop AI Supervisor — Master Report
  </div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Admin-only check
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => ["admin"].includes(r.role));
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    // Rate limit: 3 per hour
    const { data: allowed } = await serviceClient.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "email-activity-report",
      _max_requests: 3,
      _window_seconds: 3600,
    });
    if (allowed === false) return json({ error: "Rate limited. Max 3 reports per hour." }, 429);

    const body = await req.json().catch(() => ({}));
    const todayISO = todayISOString(body.date);
    const companyId = body.company_id;

    // Fetch data in parallel
    let commQuery = serviceClient
      .from("communications")
      .select("from_address, to_address, subject, body_preview, direction, received_at")
      .gte("received_at", todayISO)
      .lt("received_at", todayISO + "T23:59:59.999Z")
      .limit(200);

    let tasksQuery = serviceClient
      .from("tasks")
      .select("title, status, assigned_to, created_at, completed_at")
      .gte("created_at", todayISO)
      .limit(200);

    let sessionsQuery = serviceClient
      .from("chat_sessions")
      .select("user_id, agent_name, created_at")
      .gte("created_at", todayISO)
      .limit(200);

    if (companyId) {
      commQuery = commQuery.eq("company_id", companyId);
    }

    const [commResult, tasksResult, sessionsResult] = await Promise.all([
      commQuery,
      tasksQuery,
      sessionsQuery,
    ]);

    const comms = commResult.data || [];
    const tasks = tasksResult.data || [];
    const sessions = sessionsResult.data || [];

    // Fetch profiles to map user_ids to emails
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("user_id, email, full_name");

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      if (p.email && p.user_id) profileMap.set(p.user_id, p.email);
    });

    // Build per-person activity
    const people: PersonActivity[] = [];

    for (const [email, info] of Object.entries(TEAM_DIR)) {
      if (email === SUPERVISOR_EMAIL) continue; // skip ai@ for personal reports

      const sent = comms.filter(c => matchEmail(c.from_address, email));
      const received = comms.filter(c => matchEmail(c.to_address, email));

      // Tasks for this person (match by email in assigned_to or profile lookup)
      const personProfile = (profiles || []).find((p: any) => p.email === email);
      const personTasks = personProfile
        ? tasks.filter((t: any) => t.assigned_to === personProfile.user_id)
        : [];
      const tasksOpen = personTasks.filter((t: any) => t.status !== "done" && t.status !== "completed").length;
      const tasksDone = personTasks.filter((t: any) => t.status === "done" || t.status === "completed").length;

      // Agent sessions
      const personSessions = personProfile
        ? sessions.filter((s: any) => s.user_id === personProfile.user_id).length
        : 0;

      if (sent.length === 0 && received.length === 0 && personTasks.length === 0 && personSessions === 0) continue;

      const activity: PersonActivity = {
        name: info.name,
        role: info.role,
        email,
        emailsSent: sent.map(c => ({ subject: c.subject || "(no subject)", to: c.to_address || "", preview: (c.body_preview || "").slice(0, 100) })),
        emailsReceived: received.map(c => ({ subject: c.subject || "(no subject)", from: c.from_address || "", preview: (c.body_preview || "").slice(0, 100) })),
        tasksOpen,
        tasksDone,
        agentSessions: personSessions,
        aiSummary: "",
      };

      people.push(activity);
    }

    // AI summarize each person (sequential to avoid rate limits)
    for (const person of people) {
      person.aiSummary = await aiSummarize(person);
    }

    // Send reports via Gmail
    const accessToken = await getSupervisorAccessToken(serviceClient);
    const dateStr = formatDate();
    const sendResults: { email: string; success: boolean }[] = [];

    // Personal reports
    for (const person of people) {
      const html = buildPersonalReportHTML(person, dateStr);
      const subject = `Daily Activity Report — ${person.name} — ${dateStr}`;
      try {
        const ok = await sendEmail(accessToken, person.email, subject, html);
        sendResults.push({ email: person.email, success: ok });
      } catch (e) {
        console.error(`Send to ${person.email} failed:`, e);
        sendResults.push({ email: person.email, success: false });
      }
    }

    // Master report to ai@rebar.shop
    if (people.length > 0) {
      const masterHtml = buildMasterReportHTML(people, dateStr);
      try {
        const ok = await sendEmail(accessToken, SUPERVISOR_EMAIL, `Master Supervisory Report — ${dateStr}`, masterHtml);
        sendResults.push({ email: SUPERVISOR_EMAIL, success: ok });
      } catch (e) {
        console.error("Master report send failed:", e);
        sendResults.push({ email: SUPERVISOR_EMAIL, success: false });
      }
    }

    return json({
      success: true,
      date: todayISO,
      peopleProcessed: people.length,
      sendResults,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("email-activity-report error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
