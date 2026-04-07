import { handleRequest } from "../_shared/requestHandler.ts";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { corsHeaders } from "../_shared/auth.ts";

const REPORT_MAILBOXES = [
  "sattar@rebar.shop",
  "ben@rebar.shop",
  "estimation@rebar.shop",
];

const REPORT_KEYWORDS = [
  "report", "summary", "analytics", "dashboard", "digest",
  "weekly", "daily", "monthly", "stats", "performance",
  "ringcentral", "wincher", "semrush", "call summary",
  "google analytics", "search console", "transcript",
];

interface MailboxEmail {
  mailbox: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  source: string;
}

/** Refresh a Gmail access token from a stored refresh token */
async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

/** Detect the source service from email sender/subject */
function detectEmailSource(from: string, subject: string): string {
  const combined = `${from} ${subject}`.toLowerCase();
  if (combined.includes("ringcentral") || combined.includes("ring central")) return "ringcentral";
  if (combined.includes("wincher")) return "wincher";
  if (combined.includes("semrush") || combined.includes("sem rush")) return "semrush";
  if (combined.includes("call summary") || combined.includes("call report") || combined.includes("transcript")) return "call-summary";
  if (combined.includes("google analytics") || combined.includes("search console")) return "google-analytics";
  return "report";
}

/** Fetch recent emails from a single Gmail account via API */
async function fetchMailboxEmails(
  accessToken: string,
  mailbox: string,
  targetDate: string
): Promise<MailboxEmail[]> {
  const results: MailboxEmail[] = [];
  try {
    const query = `newer_than:2d`;
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      console.warn(`Failed to list emails for ${mailbox}:`, listRes.status);
      return results;
    }
    const listData = await listRes.json();
    if (!listData.messages?.length) return results;

    const msgIds = listData.messages.slice(0, 15);
    const msgPromises = msgIds.map(async (msg: { id: string }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      return msgRes.json();
    });

    const messages = await Promise.all(msgPromises);

    for (const msgData of messages) {
      if (!msgData) continue;
      const headers = msgData.payload?.headers || [];
      const getH = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      const from = getH("From");
      const subject = getH("Subject");
      const date = getH("Date");

      const combined = `${from} ${subject}`.toLowerCase();
      const isReport = REPORT_KEYWORDS.some(kw => combined.includes(kw));
      if (!isReport) continue;

      let body = msgData.snippet || "";
      const extractText = (parts: any[]): string => {
        for (const part of parts || []) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            try {
              const decoded = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              return decoded.slice(0, 2000);
            } catch { /* skip */ }
          }
          if (part.parts) {
            const nested = extractText(part.parts);
            if (nested) return nested;
          }
        }
        return "";
      };

      if (msgData.payload?.parts) {
        const extracted = extractText(msgData.payload.parts);
        if (extracted) body = extracted;
      } else if (msgData.payload?.body?.data) {
        try {
          body = atob(msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/")).slice(0, 2000);
        } catch { /* use snippet */ }
      }

      results.push({
        mailbox,
        from,
        subject,
        snippet: msgData.snippet || "",
        body: body.slice(0, 2000),
        date,
        source: detectEmailSource(from, subject),
      });
    }
  } catch (err) {
    console.warn(`Error fetching emails for ${mailbox}:`, err);
  }
  return results;
}

/** Fetch report emails from all configured mailboxes */
async function fetchAllMailboxReports(
  supabase: any,
  targetDate: string
): Promise<MailboxEmail[]> {
  const allEmails: MailboxEmail[] = [];

  const { data: tokenRows } = await supabase
    .from("user_gmail_tokens")
    .select("user_id, gmail_email, refresh_token, is_encrypted");

  if (!tokenRows?.length) {
    console.warn("No Gmail tokens found for report mailboxes");
    return allEmails;
  }

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("user_id, email");

  const emailToUserId: Record<string, string> = {};
  (profileRows || []).forEach((p: any) => {
    if (p.email) emailToUserId[p.email.toLowerCase()] = p.user_id;
  });

  const fetchPromises = REPORT_MAILBOXES.map(async (mailbox) => {
    let tokenRow = tokenRows.find((t: any) => t.gmail_email?.toLowerCase() === mailbox);
    if (!tokenRow) {
      const userId = emailToUserId[mailbox];
      if (userId) {
        tokenRow = tokenRows.find((t: any) => t.user_id === userId);
      }
    }
    if (!tokenRow) {
      console.warn(`No Gmail token found for ${mailbox}`);
      return [];
    }

    let refreshToken = tokenRow.refresh_token;
    if (tokenRow.is_encrypted) {
      try {
        refreshToken = await decryptToken(refreshToken);
      } catch {
        console.warn(`Failed to decrypt token for ${mailbox}`);
        return [];
      }
    }

    const accessToken = await refreshGmailToken(refreshToken);
    if (!accessToken) {
      console.warn(`Failed to refresh token for ${mailbox}`);
      return [];
    }

    return fetchMailboxEmails(accessToken, mailbox, targetDate);
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(emails => allEmails.push(...emails));

  return allEmails;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, userId } = ctx;

    // Rate limit
    if (userId) {
      const { data: allowed } = await supabase.rpc("check_rate_limit", {
        _user_id: userId,
        _function_name: "daily-summary",
        _max_requests: 5,
        _window_seconds: 60,
      });
      if (allowed === false) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { date, userEmail } = ctx.body;

    const { getWorkspaceTimezone } = await import("../_shared/getWorkspaceTimezone.ts");
    const tz = await getWorkspaceTimezone(supabase);
    const targetDate = date || new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    // Compute UTC boundaries for the workspace-local day
    const dayStart = (() => {
      const nowUtc = new Date();
      const localStr = nowUtc.toLocaleString("en-US", { timeZone: tz });
      const localNow = new Date(localStr);
      localNow.setHours(0, 0, 0, 0);
      const offsetMs = nowUtc.getTime() - new Date(nowUtc.toLocaleString("en-US", { timeZone: tz })).getTime();
      return new Date(localNow.getTime() + offsetMs).toISOString();
    })();
    const dayEnd = (() => {
      const nowUtc = new Date();
      const localStr = nowUtc.toLocaleString("en-US", { timeZone: tz });
      const localNow = new Date(localStr);
      localNow.setHours(23, 59, 59, 999);
      const offsetMs = nowUtc.getTime() - new Date(nowUtc.toLocaleString("en-US", { timeZone: tz })).getTime();
      return new Date(localNow.getTime() + offsetMs).toISOString();
    })();

    // ── Ben-specific personalized digest ─────────────────────────────
    if (userEmail === "ben@rebar.shop") {
      const [
        benEmailsRes, estEmailsRes, benLeadsRes, karthickLeadsRes,
        leadFilesRes, benTasksRes, benCallsRes,
      ] = await Promise.all([
        supabase.from("communications")
          .select("from_address, to_address, subject, body_preview, received_at, source")
          .or(`from_address.ilike.%ben@rebar.shop%,to_address.ilike.%ben@rebar.shop%`)
          .gte("received_at", dayStart).lte("received_at", dayEnd)
          .order("received_at", { ascending: false }).limit(30),
        supabase.from("communications")
          .select("from_address, to_address, subject, body_preview, received_at, source")
          .or(`from_address.ilike.%estimation@rebar.shop%,to_address.ilike.%estimation@rebar.shop%`)
          .gte("received_at", dayStart).lte("received_at", dayEnd)
          .order("received_at", { ascending: false }).limit(30),
        supabase.from("leads")
          .select("title, stage, expected_value, priority, source, expected_close_date, updated_at, assigned_to, notes")
          .ilike("assigned_to", "%ben%").order("updated_at", { ascending: false }).limit(30),
        supabase.from("leads")
          .select("title, stage, expected_value, priority, source, expected_close_date, updated_at, assigned_to, notes")
          .ilike("assigned_to", "%karthick%").order("updated_at", { ascending: false }).limit(30),
        supabase.from("lead_files")
          .select("file_name, file_type, lead_id, created_at, uploaded_by")
          .gte("created_at", dayStart).lte("created_at", dayEnd).limit(50),
        supabase.from("tasks")
          .select("title, description, status, priority, due_date, agent_type, created_at")
          .or(`created_at.gte.${dayStart},due_date.lte.${targetDate}`).limit(50),
        supabase.from("communications")
          .select("from_address, to_address, subject, body_preview, received_at, source, metadata")
          .eq("source", "ringcentral")
          .gte("received_at", dayStart).lte("received_at", dayEnd).limit(30),
      ]);

      const benEmails = benEmailsRes.data || [];
      const estEmails = estEmailsRes.data || [];
      const allBenEmails = [...benEmails];
      const emailIds = new Set(benEmails.map((e: any) => `${e.subject}-${e.received_at}`));
      estEmails.forEach((e: any) => {
        const key = `${e.subject}-${e.received_at}`;
        if (!emailIds.has(key)) { allBenEmails.push(e); emailIds.add(key); }
      });

      const benLeads = benLeadsRes.data || [];
      const karthickLeads = karthickLeadsRes.data || [];
      const leadFiles = leadFilesRes.data || [];
      const benTasks = benTasksRes.data || [];
      const benCalls = benCallsRes.data || [];

      const addendumFiles = leadFiles.filter((f: any) => /addendum|revision|rev\./i.test(f.file_name || ""));
      const shopDrawingFiles = leadFiles.filter((f: any) => /shop.?draw/i.test(f.file_name || ""));
      const qcLeads = benLeads.filter((l: any) => /qc|quality|flag|validation|warning|error/i.test(`${l.notes || ""} ${l.stage || ""}`));
      const overdueTasks = benTasks.filter((t: any) => t.due_date && t.due_date < targetDate && t.status !== "done" && t.status !== "completed");

      const benContext = `
=== BEN'S PERSONALIZED DAILY DATA FOR ${targetDate} ===

--- EMAILS (${allBenEmails.length} for ben@ and estimation@) ---
${allBenEmails.length > 0 ? allBenEmails.map((e: any, i: number) => `${i + 1}. From: ${e.from_address} → To: ${e.to_address} | Subject: ${e.subject || "(none)"} | Preview: ${(e.body_preview || "").slice(0, 150)}`).join("\n") : "No emails today."}

--- ESTIMATION BEN (${benLeads.length} leads assigned to Ben) ---
${benLeads.length > 0 ? benLeads.map((l: any, i: number) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Value: $${l.expected_value || 0} | Priority: ${l.priority || "normal"} | Close: ${l.expected_close_date || "N/A"}`).join("\n") : "No leads assigned to Ben."}

--- QC FLAGS (${qcLeads.length} leads with QC/validation issues) ---
${qcLeads.length > 0 ? qcLeads.map((l: any, i: number) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Notes: ${(l.notes || "").slice(0, 200)}`).join("\n") : "No QC flags found."}

--- ADDENDUMS (${addendumFiles.length} addendum/revision files today) ---
${addendumFiles.length > 0 ? addendumFiles.map((f: any, i: number) => `${i + 1}. ${f.file_name} (${f.file_type || "unknown"}) — uploaded ${f.created_at}`).join("\n") : "No addendum files today."}

--- ESTIMATION KARTHICK (${karthickLeads.length} leads assigned to Karthick) ---
${karthickLeads.length > 0 ? karthickLeads.map((l: any, i: number) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Value: $${l.expected_value || 0} | Priority: ${l.priority || "normal"}`).join("\n") : "No leads assigned to Karthick."}

--- SHOP DRAWINGS (${shopDrawingFiles.length} shop drawing files) ---
${shopDrawingFiles.length > 0 ? shopDrawingFiles.map((f: any, i: number) => `${i + 1}. ${f.file_name} — uploaded ${f.created_at}`).join("\n") : "No shop drawing files today."}

--- TASKS / EISENHOWER (${benTasks.length} tasks, ${overdueTasks.length} overdue) ---
${benTasks.length > 0 ? benTasks.map((t: any, i: number) => `${i + 1}. [${t.priority || "normal"}] ${t.title} — Status: ${t.status} | Due: ${t.due_date || "N/A"}${t.status !== "done" && t.due_date && t.due_date < targetDate ? " ⚠️ OVERDUE" : ""}`).join("\n") : "No tasks."}

--- CALLS (${benCalls.length} today) ---
${benCalls.length > 0 ? benCalls.map((c: any, i: number) => `${i + 1}. ${c.subject || "Call"} | From: ${c.from_address} → ${c.to_address} | Preview: ${(c.body_preview || "").slice(0, 100)}`).join("\n") : "No calls today."}
`;

      const benSystemPrompt = `You are a Daily Digest AI for Ben, a Senior Rebar Estimator at Rebar.shop.
Generate a personalized daily digest in JSON format with Ben's 8 specific work categories.

Return valid JSON (no markdown fences):
{
  "greeting": "Personal greeting for Ben mentioning the date",
  "affirmation": "Motivational message relevant to estimating work",
  "keyTakeaways": ["3-5 key takeaways from Ben's day, prioritized by urgency"],
  "benCategories": [
    {"title": "📧 Emails", "icon": "Mail", "items": ["Summary of each relevant email with action needed"], "urgentCount": 0},
    {"title": "📐 Estimation Ben", "icon": "FileText", "items": ["Summary of each lead/estimate Ben is working on"], "urgentCount": 0},
    {"title": "🔍 QC Ben", "icon": "AlertTriangle", "items": ["QC flags, validation warnings, issues needing review"], "urgentCount": 0},
    {"title": "📝 Addendums", "icon": "RefreshCw", "items": ["Drawing revisions, addendums received or pending"], "urgentCount": 0},
    {"title": "📊 Estimation Karthick", "icon": "Users", "items": ["Status of Karthick's estimates for Ben's oversight"], "urgentCount": 0},
    {"title": "📋 Shop Drawings", "icon": "Layers", "items": ["Shop drawings in progress or recently uploaded"], "urgentCount": 0},
    {"title": "✅ Shop Drawings for Approval", "icon": "CheckCircle", "items": ["Shop drawings pending approval or review"], "urgentCount": 0},
    {"title": "🎯 Eisenhower", "icon": "Target", "items": ["Priority matrix: urgent tasks, overdue items, calls needing follow-up"], "urgentCount": 0}
  ],
  "calendarEvents": [{"time": "9:00 AM", "title": "Suggested block", "purpose": "Why"}],
  "tipOfTheDay": {"title": "Tip", "steps": ["Step"], "closing": "Closing"},
  "randomFact": "Interesting fact about steel or construction"
}

Rules:
- urgentCount = number of items in that category that need IMMEDIATE attention
- Items should be concise, actionable summaries (not raw data)
- Prioritize overdue items and QC flags as urgent
- If a category has no data, include it with items: ["No activity today"] and urgentCount: 0
- Include specific project names, values, and deadlines from the data
- Eisenhower should synthesize tasks, overdue items, and calls into a priority matrix`;

      const { callAI } = await import("../_shared/aiRouter.ts");

      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "daily-summary-ben",
        temperature: 0.3,
        messages: [
          { role: "system", content: benSystemPrompt },
          { role: "user", content: `Generate Ben's daily digest for ${targetDate}.\n\n${benContext}` },
        ],
      });

      const rawContent = result.content || "";
      let digest;
      try {
        const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        digest = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse Ben AI response:", rawContent);
        throw new Error("Failed to parse AI digest response");
      }

      return {
        digest,
        stats: {
          emails: allBenEmails.length, tasks: benTasks.length, leads: benLeads.length,
          orders: 0, workOrders: 0, deliveries: 0,
          estimatesBen: benLeads.length, qcFlags: qcLeads.length, addendums: addendumFiles.length,
          estimatesKarthick: karthickLeads.length, shopDrawings: shopDrawingFiles.length,
          pendingApproval: shopDrawingFiles.filter((f: any) => /approval|pending|review/i.test(f.file_name || "")).length,
          overdueTasks: overdueTasks.length, phoneCalls: benCalls.length,
        },
      };
    }
    // ── End Ben-specific block ───────────────────────────────────────

    // ── Fetch all data sources in parallel ───────────────────────────
    const { data: profilesList } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, department, title")
      .eq("is_active", true);
    const profiles = profilesList || [];
    const profileMap: Record<string, string> = {};
    profiles.forEach((p: any) => {
      profileMap[p.id] = p.full_name || "Unknown";
      if (p.user_id) profileMap[p.user_id] = p.full_name || "Unknown";
    });

    const [
      emailsRes, tasksRes, leadsRes, ordersRes, workOrdersRes, deliveriesRes,
      teamMsgsRes, meetingsRes, rcCallsRes, invoicesRes, vendorsRes,
      socialPostsRes, timeClockRes, machineRunsRes, eventsRes, commandLogRes,
    ] = await Promise.all([
      supabase.from("communications").select("from_address, to_address, subject, body_preview, received_at, status, source").eq("source", "gmail").gte("received_at", dayStart).lte("received_at", dayEnd).order("received_at", { ascending: false }).limit(50),
      supabase.from("tasks").select("title, description, status, priority, due_date, agent_type").or(`created_at.gte.${dayStart},due_date.eq.${targetDate}`).limit(30),
      supabase.from("leads").select("title, stage, expected_value, priority, source, expected_close_date, updated_at").gte("updated_at", dayStart).lte("updated_at", dayEnd).order("updated_at", { ascending: false }).limit(30),
      supabase.from("orders").select("order_number, status, total_amount, required_date, notes").gte("created_at", dayStart).lte("created_at", dayEnd).limit(20),
      supabase.from("work_orders").select("work_order_number, status, scheduled_start, scheduled_end, workstation, notes").or(`scheduled_start.gte.${dayStart},actual_start.gte.${dayStart}`).limit(20),
      supabase.from("deliveries").select("delivery_number, status, scheduled_date, driver_name, notes").eq("scheduled_date", targetDate).limit(20),
      supabase.from("team_messages").select("original_text, original_language, sender_profile_id, created_at, channel_id").gte("created_at", dayStart).lte("created_at", dayEnd).order("created_at", { ascending: false }).limit(50),
      supabase.from("team_meetings").select("title, meeting_type, started_at, ended_at, ai_summary, participants, duration_seconds, status").gte("started_at", dayStart).lte("started_at", dayEnd).order("started_at", { ascending: false }).limit(20),
      supabase.from("communications").select("from_address, to_address, subject, body_preview, received_at, status, source, metadata").eq("source", "ringcentral").gte("received_at", dayStart).lte("received_at", dayEnd).order("received_at", { ascending: false }).limit(50),
      supabase.from("accounting_mirror").select("quickbooks_id, data, balance, last_synced_at").eq("entity_type", "Invoice").order("created_at", { ascending: false }).limit(30),
      supabase.from("accounting_mirror").select("quickbooks_id, data, balance").eq("entity_type", "Vendor").limit(20),
      supabase.from("social_posts").select("platform, title, content, status, scheduled_date, reach, impressions, likes, comments, shares, clicks, content_type, page_name").gte("scheduled_date", new Date(new Date(targetDate).getTime() - 7 * 86400000).toISOString().split("T")[0]).lte("scheduled_date", targetDate).order("scheduled_date", { ascending: false }).limit(30),
      supabase.from("time_clock_entries").select("profile_id, clock_in, clock_out, break_minutes, notes").gte("clock_in", dayStart).lte("clock_in", dayEnd).order("clock_in", { ascending: true }),
      supabase.from("machine_runs").select("operator_profile_id, supervisor_profile_id, process, status, started_at, ended_at, duration_seconds, input_qty, output_qty, scrap_qty, notes, machine_id").gte("started_at", dayStart).lte("started_at", dayEnd).order("started_at", { ascending: false }).limit(50),
      supabase.from("activity_events").select("event_type, entity_type, actor_id, description, created_at").gte("created_at", dayStart).lte("created_at", dayEnd).order("created_at", { ascending: false }).limit(100),
      supabase.from("command_log").select("user_id, parsed_intent, result, created_at").gte("created_at", dayStart).lte("created_at", dayEnd).order("created_at", { ascending: false }).limit(50),
    ]);

    const emails = emailsRes.data || [];
    const tasks = tasksRes.data || [];
    const leads = leadsRes.data || [];
    const orders = ordersRes.data || [];
    const workOrders = workOrdersRes.data || [];
    const deliveries = deliveriesRes.data || [];
    const teamMessages = teamMsgsRes.data || [];
    const meetings = meetingsRes.data || [];
    const rcCalls = rcCallsRes.data || [];
    const invoices = invoicesRes.data || [];
    const vendors = vendorsRes.data || [];
    const socialPosts = socialPostsRes.data || [];
    const timeEntries = timeClockRes.data || [];
    const machineRuns = machineRunsRes.data || [];
    const erpEvents = eventsRes.data || [];
    const commandLogs = commandLogRes.data || [];

    // ── Fetch report emails from all mailboxes ──
    let mailboxReports: MailboxEmail[] = [];
    try {
      mailboxReports = await fetchAllMailboxReports(supabase, targetDate);
      console.log(`Fetched ${mailboxReports.length} report emails from ${REPORT_MAILBOXES.join(", ")}`);
    } catch (err) {
      console.warn("Failed to fetch mailbox reports:", err);
    }

    const reportsBySource: Record<string, MailboxEmail[]> = {};
    mailboxReports.forEach(r => {
      if (!reportsBySource[r.source]) reportsBySource[r.source] = [];
      reportsBySource[r.source].push(r);
    });

    // ── Compute QuickBooks summary ──
    const totalAR = invoices.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);
    const overdueInvoices = invoices.filter((inv: any) => {
      const dueDate = inv.data?.DueDate;
      return dueDate && dueDate < targetDate && (inv.balance || 0) > 0;
    });
    const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);

    // ── Compute social media summary ──
    const totalReach = socialPosts.reduce((sum: number, p: any) => sum + (p.reach || 0), 0);
    const totalImpressions = socialPosts.reduce((sum: number, p: any) => sum + (p.impressions || 0), 0);
    const totalLikes = socialPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0);
    const totalComments = socialPosts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0);
    const totalShares = socialPosts.reduce((sum: number, p: any) => sum + (p.shares || 0), 0);
    const totalClicks = socialPosts.reduce((sum: number, p: any) => sum + (p.clicks || 0), 0);
    const publishedPosts = socialPosts.filter((p: any) => p.status === "published");
    const scheduledPosts = socialPosts.filter((p: any) => p.status === "scheduled");
    const platformBreakdown: Record<string, number> = {};
    publishedPosts.forEach((p: any) => { platformBreakdown[p.platform] = (platformBreakdown[p.platform] || 0) + 1; });

    // ── Build context for AI ──
    const dataContext = `
=== DAILY DATA FOR ${targetDate} ===

--- EMAILS (${emails.length} received today) ---
${emails.length > 0 ? emails.map((e: any, i: number) => `${i + 1}. From: ${e.from_address} | Subject: ${e.subject || "(no subject)"} | Preview: ${(e.body_preview || "").slice(0, 150)}`).join("\n") : "No emails received today."}

--- TASKS (${tasks.length} active/due) ---
${tasks.length > 0 ? tasks.map((t: any, i: number) => `${i + 1}. [${t.priority || "normal"}] ${t.title} — Status: ${t.status || "pending"}${t.due_date ? ` | Due: ${t.due_date}` : ""}`).join("\n") : "No tasks due today."}

--- SALES PIPELINE (${leads.length} active leads) ---
${leads.length > 0 ? leads.map((l: any, i: number) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Value: $${l.expected_value || 0} | Priority: ${l.priority || "normal"}`).join("\n") : "No active leads."}

--- ORDERS (${orders.length} new today) ---
${orders.length > 0 ? orders.map((o: any, i: number) => `${i + 1}. #${o.order_number} — Status: ${o.status} | Amount: $${o.total_amount || 0}`).join("\n") : "No new orders today."}

--- SHOP FLOOR (${workOrders.length} work orders) ---
${workOrders.length > 0 ? workOrders.map((w: any, i: number) => `${i + 1}. WO#${w.work_order_number} — Status: ${w.status} | Station: ${w.workstation || "unassigned"}`).join("\n") : "No work orders scheduled."}

--- DELIVERIES (${deliveries.length} scheduled) ---
${deliveries.length > 0 ? deliveries.map((d: any, i: number) => `${i + 1}. ${d.delivery_number} — Status: ${d.status} | Driver: ${d.driver_name || "unassigned"}`).join("\n") : "No deliveries scheduled."}

--- TEAM HUB (${teamMessages.length} messages today) ---
${teamMessages.length > 0 ? teamMessages.map((m: any, i: number) => `${i + 1}. [${m.original_language}] ${(m.original_text || "").slice(0, 200)}`).join("\n") : "No team messages today."}

--- TEAM MEETINGS (${meetings.length} today) ---
${meetings.length > 0 ? meetings.map((m: any, i: number) => { const dur = m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}min` : "ongoing"; const participants = (m.participants || []).join(", ") || "N/A"; return `${i + 1}. ${m.title} (${m.meeting_type}) — ${dur} | Participants: ${participants}${m.ai_summary ? `\n   Summary: ${m.ai_summary}` : ""}`; }).join("\n") : "No team meetings today."}

--- RINGCENTRAL CALLS & SMS (${rcCalls.length} today) ---
${rcCalls.length > 0 ? rcCalls.map((c: any, i: number) => { const meta = c.metadata || {}; const type = meta.type || "call"; const duration = meta.duration ? `${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s` : ""; const result = meta.result || ""; return `${i + 1}. [${type.toUpperCase()}] ${c.subject || ""} | From: ${c.from_address} → To: ${c.to_address}${duration ? ` | Duration: ${duration}` : ""}${result ? ` | Result: ${result}` : ""}`; }).join("\n") : "No RingCentral calls/SMS today."}

--- QUICKBOOKS FINANCIALS ---
Total Accounts Receivable: $${totalAR.toFixed(2)}
Overdue Invoices: ${overdueInvoices.length} totaling $${totalOverdue.toFixed(2)}
${overdueInvoices.length > 0 ? overdueInvoices.slice(0, 10).map((inv: any, i: number) => { const d = inv.data || {}; const custName = d.CustomerRef?.name || "Unlinked"; return `${i + 1}. Invoice #${d.DocNumber || inv.quickbooks_id} | Customer: ${custName} | Balance: $${inv.balance} | Due: ${d.DueDate || "N/A"}`; }).join("\n") : ""}
Total Vendors on file: ${vendors.length}

--- SOCIAL MEDIA (last 7 days) ---
Published Posts: ${publishedPosts.length} | Scheduled: ${scheduledPosts.length}
Platform breakdown: ${Object.entries(platformBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}
Total Reach: ${totalReach.toLocaleString()} | Impressions: ${totalImpressions.toLocaleString()}
Engagement: ${totalLikes} likes, ${totalComments} comments, ${totalShares} shares, ${totalClicks} clicks
${publishedPosts.length > 0 ? "Top posts:\n" + publishedPosts.slice(0, 5).map((p: any, i: number) => `${i + 1}. [${p.platform}] ${p.title || (p.content || "").slice(0, 80)} — Reach: ${p.reach || 0} | Likes: ${p.likes || 0} | Clicks: ${p.clicks || 0}`).join("\n") : "No published posts in last 7 days."}

--- EMPLOYEE TIME CLOCK (${timeEntries.length} entries today) ---
${timeEntries.length > 0 ? timeEntries.map((t: any, i: number) => { const name = profileMap[t.profile_id] || t.profile_id; const clockIn = t.clock_in ? new Date(t.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "?"; const clockOut = t.clock_out ? new Date(t.clock_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "still clocked in"; const hrs = t.clock_out ? ((new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000).toFixed(1) : "ongoing"; return `${i + 1}. ${name} — In: ${clockIn} | Out: ${clockOut} | Hours: ${hrs}h${t.break_minutes ? ` | Break: ${t.break_minutes}min` : ""}${t.notes ? ` | Note: ${t.notes}` : ""}`; }).join("\n") : "No time clock entries today."}

--- PRODUCTION RUNS (${machineRuns.length} machine runs today) ---
${machineRuns.length > 0 ? (() => { const totalOutput = machineRuns.reduce((s: number, r: any) => s + (r.output_qty || 0), 0); const totalScrap = machineRuns.reduce((s: number, r: any) => s + (r.scrap_qty || 0), 0); const completedRuns = machineRuns.filter((r: any) => r.status === "completed").length; const operatorStats: Record<string, { runs: number; output: number }> = {}; machineRuns.forEach((r: any) => { const name = profileMap[r.operator_profile_id] || "Unknown"; if (!operatorStats[name]) operatorStats[name] = { runs: 0, output: 0 }; operatorStats[name].runs++; operatorStats[name].output += r.output_qty || 0; }); const opLines = Object.entries(operatorStats).map(([name, s]) => `  • ${name}: ${s.runs} runs, ${s.output} pcs produced`).join("\n"); const runLines = machineRuns.slice(0, 10).map((r: any, i: number) => { const op = profileMap[r.operator_profile_id] || "Unknown"; return `${i + 1}. [${r.process}] ${op} — Status: ${r.status} | In: ${r.input_qty || 0} → Out: ${r.output_qty || 0} | Scrap: ${r.scrap_qty || 0}`; }).join("\n"); return `Summary: ${completedRuns}/${machineRuns.length} completed | Output: ${totalOutput} pcs | Scrap: ${totalScrap} pcs\nPer operator:\n${opLines}\nRecent runs:\n${runLines}`; })() : "No production runs today."}

--- ERP ACTIVITY LOG (${erpEvents.length} events today) ---
${erpEvents.length > 0 ? (() => { const eventsByType: Record<string, number> = {}; const actorActivity: Record<string, number> = {}; erpEvents.forEach((e: any) => { const key = `${e.event_type}:${e.entity_type}`; eventsByType[key] = (eventsByType[key] || 0) + 1; const name = profileMap[e.actor_id] || e.actor_id || "system"; actorActivity[name] = (actorActivity[name] || 0) + 1; }); const eventBreakdown = Object.entries(eventsByType).map(([k, v]) => `${k} (${v})`).join(", "); const userBreakdown = Object.entries(actorActivity).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name}: ${count} actions`).join(", "); return `Event breakdown: ${eventBreakdown}\nUser activity: ${userBreakdown}`; })() : "No ERP events logged today."}

--- AI ASSISTANT USAGE (${commandLogs.length} commands today) ---
${commandLogs.length > 0 ? (() => { const intentCounts: Record<string, number> = {}; commandLogs.forEach((c: any) => { const intent = c.parsed_intent || "unknown"; intentCounts[intent] = (intentCounts[intent] || 0) + 1; }); return `Commands: ${Object.entries(intentCounts).map(([k, v]) => `${k} (${v})`).join(", ")}`; })() : "No AI commands used today."}

--- AGENT & HUMAN ACTIVITY REPORT ---
${(() => { const agentTaskCounts: Record<string, number> = {}; tasks.forEach((t: any) => { if (t.agent_type) { agentTaskCounts[t.agent_type] = (agentTaskCounts[t.agent_type] || 0) + 1; } }); const humanCommands: Record<string, { count: number; intents: Set<string> }> = {}; commandLogs.forEach((c: any) => { const name = profileMap[c.user_id] || c.user_id || "Unknown"; if (!humanCommands[name]) humanCommands[name] = { count: 0, intents: new Set() }; humanCommands[name].count++; if (c.parsed_intent) humanCommands[name].intents.add(c.parsed_intent); }); const agentNames: Record<string, string> = { sales: "Blitz (Sales)", accounting: "Penny (Accounting)", support: "Haven (Support)", collections: "Chase (Collections)", estimation: "Cal (Estimation)", social: "Pixel (Social)", eisenhower: "Eisenhower (Priority)", bizdev: "Spark (BizDev)", webbuilder: "WebBuilder", assistant: "Assistant (CEO)", copywriting: "Copywriter", talent: "Talent", seo: "SEO", growth: "Growth", legal: "Tally (Legal)" }; let report = `Agent tasks created today:\n`; if (Object.keys(agentTaskCounts).length > 0) { report += Object.entries(agentTaskCounts).map(([agent, count]) => `  • ${agentNames[agent] || agent}: ${count} tasks created`).join("\n"); } else { report += "  No agent-created tasks today."; } report += `\n\nHuman AI usage today (${Object.keys(humanCommands).length} users):\n`; if (Object.keys(humanCommands).length > 0) { report += Object.entries(humanCommands).map(([name, data]) => `  • ${name}: ${data.count} commands (${[...data.intents].join(", ")})`).join("\n"); } else { report += "  No human AI usage today."; } return report; })()}

--- MAILBOX REPORTS FROM ai@rebar.shop, vicky@rebar.shop, neel@rebar.shop (${mailboxReports.length} reports found) ---
${mailboxReports.length > 0 ? (() => { const sections: string[] = []; for (const [source, reports] of Object.entries(reportsBySource)) { sections.push(`\n📬 ${source.toUpperCase()} REPORTS (${reports.length}):`); reports.forEach((r, i) => { sections.push(`${i + 1}. [${r.mailbox}] From: ${r.from}\n   Subject: ${r.subject}\n   Content: ${r.body.replace(/\n/g, " ").slice(0, 500)}`); }); } return sections.join("\n"); })() : "No report emails found in ai@rebar.shop, vicky@rebar.shop, or neel@rebar.shop mailboxes."}
`;

    // ── Call Gemini AI ──
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const systemPrompt = `You are a smart Daily Digest AI assistant for a steel/rebar manufacturing company called Rebar.shop. 
Generate a structured daily summary digest in JSON format based on real business data provided.

You MUST return valid JSON with this exact structure (no markdown, no code fences):
{
  "greeting": "A warm personalized greeting mentioning the date and day of week",
  "affirmation": "A motivational business affirmation relevant to the day's activities",
  "keyTakeaways": ["Array of 3-6 key business takeaways with emoji, each a concise actionable insight covering the most important areas"],
  "financialSnapshot": {"totalAR": "", "overdueCount": "", "overdueAmount": "", "highlights": [], "cashFlowNote": ""},
  "emailCategories": [{"category": "", "emails": [{"subject": "", "summary": "", "action": ""}]}],
  "meetingSummaries": [{"title": "", "type": "", "duration": "", "summary": "", "actionItems": []}],
  "phoneCalls": [{"contact": "", "direction": "", "duration": "", "summary": "", "action": ""}],
  "socialMediaDigest": {"totalReach": "", "totalEngagement": "", "topPlatform": "", "highlights": [], "recommendations": []},
  "employeeReport": {"totalClocked": "", "totalHours": "", "highlights": [], "concerns": []},
  "productionReport": {"totalRuns": "", "totalOutput": "", "scrapRate": "", "topOperators": [], "issues": []},
  "erpActivity": {"totalEvents": "", "mostActiveUsers": [], "summary": ""},
  "agentActivityReport": {"totalInteractions": "", "agentBreakdown": [{"agent": "", "interactions": 0, "tasksCreated": 0, "highlights": []}], "humanActivity": [{"name": "", "agentsUsed": [], "totalCommands": 0, "highlights": []}]},
  "calendarEvents": [{"time": "", "title": "", "purpose": ""}],
  "tipOfTheDay": {"title": "", "steps": [], "closing": ""},
  "randomFact": ""
}

Rules:
- Group emails by business category
- Prioritize urgent items first
- Include specific numbers, names, and amounts
- Analyze MAILBOX REPORTS for RingCentral, Wincher, SEMrush, call summaries, Google Analytics data
- Include employee time clock, production runs, ERP activity, and agent usage data`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nGenerate the daily digest for ${targetDate}.\n\n${dataContext}` }] },
          ],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);
      throw new Error(`Gemini API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let digest;
    try {
      let cleaned = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      try {
        digest = JSON.parse(cleaned);
      } catch {
        cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, (ch) => ch === "\n" || ch === "\t" ? ch : "");
        digest = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      console.error("Parse error:", parseErr);
      throw new Error("Failed to parse AI digest response");
    }

    return {
      digest,
      stats: {
        emails: emails.length, tasks: tasks.length, leads: leads.length,
        orders: orders.length, workOrders: workOrders.length, deliveries: deliveries.length,
        teamMessages: teamMessages.length, meetings: meetings.length,
        phoneCalls: rcCalls.length, invoices: invoices.length,
        overdueInvoices: overdueInvoices.length, socialPosts: publishedPosts.length,
        employeesClocked: timeEntries.length, machineRuns: machineRuns.length,
        erpEvents: erpEvents.length, mailboxReports: mailboxReports.length,
        agentInteractions: commandLogs.length + tasks.filter((t: any) => t.agent_type).length,
      },
    };
  }, { functionName: "daily-summary", authMode: "required", requireCompany: false, wrapResult: false })
);
