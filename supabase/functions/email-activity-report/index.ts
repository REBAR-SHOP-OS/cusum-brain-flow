import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

const TEAM_DIR: Record<string, { name: string; role: string; agent?: string }> = {
  "sattar@rebar.shop": { name: "Sattar Esmaeili", role: "CEO", agent: "Vizzy" },
  "neel@rebar.shop": { name: "Neel Mahajan", role: "Sales", agent: "Blitz" },
  "vicky@rebar.shop": { name: "Vicky Anderson", role: "Accountant", agent: "Penny" },
  "saurabh@rebar.shop": { name: "Saurabh Seghal", role: "Sales", agent: "Blitz" },
  "ben@rebar.shop": { name: "Ben Rajabifar", role: "Estimator", agent: "Gauge" },
  "kourosh@rebar.shop": { name: "Kourosh Zand", role: "Shop Supervisor", agent: "Forge" },
  "radin@rebar.shop": { name: "Radin Lachini", role: "AI Manager", agent: "Relay" },
  "ai@rebar.shop": { name: "AI Supervisor", role: "Shared Mailbox" },
};

const SUPERVISOR_EMAIL = "ai@rebar.shop";

interface PersonActivity {
  name: string;
  role: string;
  email: string;
  agentShadow?: string;
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
  try {
    const { callAI } = await import("../_shared/aiRouter.ts");

    const emailList = [
      ...personData.emailsSent.map(e => `SENT to ${e.to}: "${e.subject}" — ${e.preview}`),
      ...personData.emailsReceived.map(e => `RECEIVED from ${e.from}: "${e.subject}" — ${e.preview}`),
    ].join("\n");

    const unanswered = personData.emailsReceived.length - personData.emailsSent.length;
    const responseRate = personData.emailsReceived.length > 0 
      ? Math.round((personData.emailsSent.length / personData.emailsReceived.length) * 100) 
      : 100;

    const prompt = `You are a performance coach and business analyst. Analyze this person's FULL activity for today and produce a structured coaching report.

Person: ${personData.name} (${personData.role})
Tasks: ${personData.tasksOpen} open, ${personData.tasksDone} completed
Agent Sessions: ${personData.agentSessions}
Email Response Rate: ${responseRate}% (${personData.emailsSent.length} sent / ${personData.emailsReceived.length} received)
${unanswered > 0 ? `⚠️ Approximately ${unanswered} emails may be unanswered` : ""}

Emails:
${emailList || "No email activity today."}

PRODUCE THIS EXACT FORMAT:

SCORE: [0-100 based on responsiveness, task completion, engagement]

STRENGTHS (evidence-based, max 4):
- [specific good behavior with evidence from data above]

AREAS TO IMPROVE (evidence-based, max 4):
- [specific gap with evidence]

COACHING TIPS (max 3):
- [actionable suggestion based on the gaps identified]

KEY NOTES (max 4):
- [important email threads or topics]

RULES: Be supportive but honest. Use data evidence. No fluff. Short sentences.`;

    // GPT-4o-mini: short structured analysis
    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a concise business analyst extracting key notes and action items from daily email activity." },
        { role: "user", content: prompt },
      ],
    });

    return result.content || "No summary generated.";
  } catch (e) {
    console.warn("AI summarize error:", e);
    return "AI summary unavailable.";
  }
}

function buildPersonalReportHTML(person: PersonActivity, dateStr: string): string {
  // Extract score from AI summary
  const scoreMatch = person.aiSummary.match(/SCORE:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Attention";

  // Parse sections from AI summary
  const sections = person.aiSummary.split(/\n(?=STRENGTHS|AREAS TO IMPROVE|COACHING TIPS|KEY NOTES|SCORE)/i);
  const formatSection = (text: string) => text.replace(/^- /gm, "• ").replace(/\n/g, "<br>");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:24px 32px;color:#fff;position:relative;">
    <h1 style="margin:0;font-size:20px;">🧠 Business Pulse — Performance Report</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${person.name} (${person.role}${(person as any).agentShadow ? ` — AI: ${(person as any).agentShadow}` : ''}) — ${dateStr}</p>
    <div style="position:absolute;right:32px;top:50%;transform:translateY(-50%);background:${scoreColor};color:#fff;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
      <span style="font-size:18px;font-weight:bold;line-height:1;">${score}</span>
      <span style="font-size:8px;opacity:0.9;">${scoreLabel}</span>
    </div>
  </div>
  <div style="padding:24px 32px;">
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:#16a34a;">${person.emailsSent.length}</div>
        <div style="font-size:11px;color:#666;">Emails Sent</div>
      </div>
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:#2563eb;">${person.emailsReceived.length}</div>
        <div style="font-size:11px;color:#666;">Emails Received</div>
      </div>
      <div style="flex:1;background:#fefce8;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:#ca8a04;">${person.tasksOpen}/${person.tasksDone}</div>
        <div style="font-size:11px;color:#666;">Open/Done Tasks</div>
      </div>
      <div style="flex:1;background:#f5f3ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:#7c3aed;">${person.agentSessions}</div>
        <div style="font-size:11px;color:#666;">AI Sessions</div>
      </div>
    </div>
    
    <div style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;background:#f8f9fa;padding:16px;border-radius:6px;">${formatSection(person.aiSummary)}</div>
  </div>
  <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:12px;color:#888;">
    Rebar.shop Brain Intelligence — Automated Performance Report
  </div>
</div></body></html>`;
}

function buildMasterReportHTML(people: PersonActivity[], dateStr: string, alertSummaryHtml?: string): string {
  // Extract scores and sort for leaderboard
  const scored = people.map(p => {
    const scoreMatch = p.aiSummary.match(/SCORE:\s*(\d+)/i);
    return { ...p, score: scoreMatch ? parseInt(scoreMatch[1]) : 0 };
  }).sort((a, b) => b.score - a.score);

  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0;
  const avgColor = avgScore >= 80 ? "#22c55e" : avgScore >= 60 ? "#f59e0b" : "#ef4444";

  const leaderboardRows = scored.map((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    const scoreColor = p.score >= 80 ? "#22c55e" : p.score >= 60 ? "#f59e0b" : "#ef4444";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${medal}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;"><strong>${p.name}</strong><br><span style="color:#888;font-size:12px;">${p.role}${(p as any).agentShadow ? ` (${(p as any).agentShadow})` : ''}</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;color:${scoreColor};font-weight:bold;">${p.score}/100</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.emailsSent.length}/${p.emailsReceived.length}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.tasksOpen}/${p.tasksDone}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${p.agentSessions}</td>
    </tr>`;
  }).join("");

  const needsAttention = scored.filter(p => p.score < 60).map(p => p.name).join(", ") || "None";
  const starPerformers = scored.filter(p => p.score >= 80).map(p => p.name).join(", ") || "None";

  const summaries = scored.map(p => {
    const scoreColor = p.score >= 80 ? "#22c55e" : p.score >= 60 ? "#f59e0b" : "#ef4444";
    return `<div style="margin-bottom:20px;border-left:3px solid ${scoreColor};padding-left:12px;">
      <h3 style="font-size:15px;color:#1a1a2e;margin:0 0 8px;">${p.name} (${p.role}${(p as any).agentShadow ? ` — ${(p as any).agentShadow}` : ''}) — <span style="color:${scoreColor}">${p.score}/100</span></h3>
      <div style="font-size:13px;color:#333;line-height:1.5;white-space:pre-wrap;background:#f8f9fa;padding:12px;border-radius:6px;">${p.aiSummary.replace(/\n/g, "<br>")}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:24px 32px;color:#fff;position:relative;">
    <h1 style="margin:0;font-size:20px;">🧠 Master Business Pulse</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${dateStr} — Team Performance Intelligence</p>
    <div style="position:absolute;right:32px;top:50%;transform:translateY(-50%);background:${avgColor};color:#fff;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
      <span style="font-size:18px;font-weight:bold;line-height:1;">${avgScore}</span>
      <span style="font-size:8px;opacity:0.9;">Team Avg</span>
    </div>
  </div>
  <div style="padding:24px 32px;">
    <div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;">⭐ <strong>Star Performers:</strong> ${starPerformers}</p>
      <p style="margin:4px 0 0;font-size:14px;">⚠️ <strong>Needs Attention:</strong> ${needsAttention}</p>
      ${alertSummaryHtml ? `<p style="margin:4px 0 0;font-size:14px;">🔔 <strong>Open Alerts:</strong> ${alertSummaryHtml}</p>` : ""}
    </div>
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;">🏆 Team Leaderboard</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f0f0f5;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;">#</th>
        <th style="padding:8px 12px;text-align:left;font-size:13px;">Person</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Score</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Sent/Rcvd</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Open/Done</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">AI</th>
      </tr></thead>
      <tbody>${leaderboardRows}</tbody>
    </table>
    <h2 style="font-size:16px;color:#1a1a2e;border-bottom:2px solid #e8e8ed;padding-bottom:8px;margin-top:24px;">📋 Per-Person Coaching Reports</h2>
    ${summaries}
  </div>
  <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:12px;color:#888;">
    Rebar.shop Brain Intelligence — Master Supervisory Report
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
        agentShadow: info.agent,
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

    // Master report to ai@rebar.shop (or comms_config brief_recipients)
    if (people.length > 0) {
      // Fetch open alerts for summary
      let alertSummaryHtml = "";
      try {
        const { data: openAlerts } = await serviceClient
          .from("comms_alerts")
          .select("alert_type, owner_email, created_at")
          .is("resolved_at", null)
          .gte("created_at", todayISO)
          .limit(50);
        
        if (openAlerts && openAlerts.length > 0) {
          const byType: Record<string, number> = {};
          for (const a of openAlerts) {
            byType[a.alert_type] = (byType[a.alert_type] || 0) + 1;
          }
          alertSummaryHtml = Object.entries(byType)
            .map(([t, c]) => `${t.replace(/_/g, " ")}: <strong>${c}</strong>`)
            .join(" | ");
        }
      } catch (e) {
        console.warn("Alert summary fetch failed (non-fatal):", e);
      }

      // Fetch brief recipients from config
      let briefRecipients = [SUPERVISOR_EMAIL];
      try {
        const { data: commsConf } = await serviceClient
          .from("comms_config")
          .select("brief_recipients")
          .eq("company_id", "a0000000-0000-0000-0000-000000000001")
          .maybeSingle();
        if (commsConf?.brief_recipients?.length) briefRecipients = commsConf.brief_recipients;
      } catch (e) {
        console.warn("Comms config fetch failed (non-fatal):", e);
      }

      const masterHtml = buildMasterReportHTML(people, dateStr, alertSummaryHtml);
      for (const recipient of briefRecipients) {
        try {
          const ok = await sendEmail(accessToken, recipient, `Master Supervisory Report — ${dateStr}`, masterHtml);
          sendResults.push({ email: recipient, success: ok });
        } catch (e) {
          console.error(`Master report to ${recipient} failed:`, e);
          sendResults.push({ email: recipient, success: false });
        }
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
