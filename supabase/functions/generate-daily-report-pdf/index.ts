import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Invalid token");

    const body = await req.json().catch(() => ({}));
    const dateStr = body.date || new Date().toISOString().split("T")[0];
    const targetUserId = body.targetUserId || null;
    const targetUserName = body.targetUserName || "Unknown";

    // If targetUserId is provided, generate a per-user report
    if (targetUserId) {
      const userData = await buildUserSpecificContext(supabase, targetUserId, dateStr);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a senior operations analyst writing a comprehensive INDIVIDUAL EMPLOYEE Daily Activity Report for REBAR SHOP.
Write a LONG, DETAILED report (2000-4000 words) covering EVERYTHING this specific employee did during the day. Use ONLY the real data provided — never fabricate numbers.

Format the report in clean HTML sections. Use these exact section headers:
1. EMPLOYEE OVERVIEW — Name, role, job title, date
2. TIME CLOCK SUMMARY — Clock in/out times, total hours, breaks, overtime status
3. HOURLY ACTIVITY TIMELINE — Hour-by-hour breakdown of what the employee did (page visits, actions, etc.)
4. SYSTEM NAVIGATION — All pages/sections visited with timestamps and frequency
5. DATA ACTIONS PERFORMED — All create/update/delete operations on leads, orders, invoices, barlists, etc. with details
6. COMMUNICATIONS — Emails sent/received, calls made, messages
7. AI AGENT INTERACTIONS — Which AI agents were used, session counts, queries made
8. PRODUCTION ACTIVITY — Machine operations, cut plans, production tasks if applicable
9. PERFORMANCE SUMMARY — Total actions count, productivity assessment, key accomplishments
10. RECOMMENDATIONS — Observations and suggestions

Rules:
- Use real data from the provided context, formatted with timestamps
- Include specific entity names, amounts, and action details
- If a section has no data, state "No activity recorded for this period"
- Write in professional business English
- Use bullet points and sub-sections for readability
- Group activities by category and time
- DO NOT wrap output in markdown code fences — output raw HTML only`
            },
            {
              role: "user",
              content: `Generate the Individual Employee Daily Activity Report for ${targetUserName} on ${dateStr}.\n\nHere is all their activity data:\n\n${userData}`
            }
          ],
          temperature: 0.3,
          max_tokens: 8000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error(`AI generation failed (${aiResponse.status})`);
      }

      const aiData = await aiResponse.json();
      const reportContent = aiData.choices?.[0]?.message?.content || "Report generation failed.";

      const htmlDoc = buildHtmlDocument(reportContent, dateStr, targetUserName);

      return new Response(JSON.stringify({ html: htmlDoc }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: company-wide report (original behavior)
    const { buildFullVizzyContext } = await import("../_shared/vizzyFullContext.ts");
    const contextText = await buildFullVizzyContext(supabase, user.id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a senior business analyst writing a comprehensive Daily Operations Report for REBAR SHOP, a rebar fabrication company. 
Write a LONG, DETAILED report (3000-5000 words) covering EVERY department. Use ONLY the real data provided — never fabricate numbers.

Format the report in clean HTML sections. Use these exact section headers:
1. EXECUTIVE SUMMARY — Key highlights, risks, and wins in 3-5 bullet points
2. TEAM & ATTENDANCE — Who clocked in/out, hours worked, who's absent
3. FINANCIAL HEALTH — AR, AP, overdue invoices, recent payments, cash flow status
4. PRODUCTION — Machine runs, cut plans, queue items, output quantities, operator performance
5. SALES PIPELINE — Open leads, hot deals, conversion rates, follow-up needed
6. CUSTOMER COMMUNICATIONS — Emails received, calls made/received, unanswered items
7. DELIVERIES & LOGISTICS — Scheduled deliveries, in-transit, completed
8. AI AGENT ACTIVITY — Which agents were used, session counts, key actions
9. ERP SYSTEM ACTIVITY — User actions, page views, mutations by department
10. RED FLAGS & RECOMMENDATIONS — Issues needing immediate attention, suggestions

Rules:
- Use real numbers from the data, formatted as currency where applicable
- Include specific employee names, customer names, amounts
- If a section has no data, state "No activity recorded for this period"
- Write in professional business English
- Use bullet points and sub-sections for readability
- DO NOT wrap output in markdown code fences — output raw HTML only`
          },
          {
            role: "user",
            content: `Generate the Daily Operations Report for ${dateStr}.\n\nHere is all operational data:\n\n${contextText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI generation failed (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices?.[0]?.message?.content || "Report generation failed.";

    const htmlDoc = buildHtmlDocument(reportContent, dateStr, "Company-Wide");

    return new Response(JSON.stringify({ html: htmlDoc }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-daily-report-pdf error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Build user-specific context by querying all relevant tables */
async function buildUserSpecificContext(supabase: any, userId: string, dateStr: string): Promise<string> {
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;

  // Get profile info
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, job_title, email, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  const profileId = profile?.id;

  // Run all queries in parallel
  const [activitiesRes, timeClockRes, chatSessionsRes, agentActionsRes] = await Promise.all([
    // Activity events for this user
    supabase
      .from("activity_events")
      .select("event_type, entity_type, description, created_at, source, metadata")
      .eq("actor_id", userId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true })
      .limit(500),

    // Time clock entries
    profileId
      ? supabase
          .from("time_clock_entries")
          .select("clock_in, clock_out, break_minutes, notes, source")
          .eq("profile_id", profileId)
          .gte("clock_in", dayStart)
          .lte("clock_in", dayEnd)
          .order("clock_in", { ascending: true })
      : { data: [] },

    // Chat sessions (AI agent usage)
    supabase
      .from("chat_sessions")
      .select("agent_name, title, created_at, updated_at")
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true })
      .limit(50),

    // Agent action log
    supabase
      .from("agent_action_log")
      .select("action_type, entity_type, entity_id, created_at, payload, result")
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const sections: string[] = [];

  // Profile
  sections.push(`=== EMPLOYEE PROFILE ===
Name: ${profile?.full_name || "Unknown"}
Role: ${profile?.role || "N/A"}
Job Title: ${profile?.job_title || "N/A"}
Email: ${profile?.email || "N/A"}
Currently Active: ${profile?.is_active ? "Yes" : "No"}`);

  // Time clock
  const timeEntries = timeClockRes.data || [];
  if (timeEntries.length > 0) {
    sections.push(`=== TIME CLOCK ENTRIES (${timeEntries.length}) ===
${timeEntries.map((e: any) => `Clock In: ${e.clock_in} | Clock Out: ${e.clock_out || "STILL ACTIVE"} | Break: ${e.break_minutes || 0} min | Notes: ${e.notes || "-"}`).join("\n")}`);
  } else {
    sections.push("=== TIME CLOCK ENTRIES ===\nNo time clock entries for this date.");
  }

  // Activity events grouped by type
  const activities = activitiesRes.data || [];
  if (activities.length > 0) {
    const grouped: Record<string, any[]> = {};
    for (const a of activities) {
      const key = `${a.event_type}·${a.entity_type}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    }

    let actText = `=== ACTIVITY EVENTS (${activities.length} total) ===\n`;
    for (const [key, items] of Object.entries(grouped)) {
      actText += `\n--- ${key} (${items.length}) ---\n`;
      for (const item of items) {
        const meta = item.metadata ? JSON.stringify(item.metadata) : "";
        actText += `  [${item.created_at}] ${item.description || key} ${meta ? `| metadata: ${meta}` : ""}\n`;
      }
    }
    sections.push(actText);
  } else {
    sections.push("=== ACTIVITY EVENTS ===\nNo activity events for this date.");
  }

  // Chat sessions
  const chats = chatSessionsRes.data || [];
  if (chats.length > 0) {
    sections.push(`=== AI AGENT SESSIONS (${chats.length}) ===
${chats.map((c: any) => `Agent: ${c.agent_name} | Title: ${c.title} | Started: ${c.created_at}`).join("\n")}`);
  } else {
    sections.push("=== AI AGENT SESSIONS ===\nNo AI agent sessions for this date.");
  }

  // Agent actions
  const actions = agentActionsRes.data || [];
  if (actions.length > 0) {
    sections.push(`=== AGENT ACTIONS (${actions.length}) ===
${actions.map((a: any) => `[${a.created_at}] ${a.action_type} on ${a.entity_type || "system"} (${a.entity_id || "-"})`).join("\n")}`);
  } else {
    sections.push("=== AGENT ACTIONS ===\nNo agent actions for this date.");
  }

  return sections.join("\n\n");
}

/** Build the full HTML document wrapper */
function buildHtmlDocument(reportContent: string, dateStr: string, entityName: string): string {
  const isUserReport = entityName !== "Company-Wide";
  const title = isUserReport
    ? `Employee Activity Report — ${entityName} — ${dateStr}`
    : `Daily Operations Report — ${dateStr}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  @page { margin: 1in; size: letter; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
  .header { text-align: center; border-bottom: 3px solid ${isUserReport ? "#dc2626" : "#1a56db"}; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; color: ${isUserReport ? "#dc2626" : "#1a56db"}; margin-bottom: 5px; }
  .header .subtitle { font-size: 14px; color: #666; }
  .header .date { font-size: 18px; font-weight: 600; color: #333; margin-top: 8px; }
  h2 { font-size: 18px; color: ${isUserReport ? "#dc2626" : "#1a56db"}; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 30px 0 15px; page-break-after: avoid; }
  h3 { font-size: 15px; color: #374151; margin: 15px 0 8px; }
  p { margin-bottom: 10px; font-size: 14px; }
  ul, ol { margin: 8px 0 15px 25px; font-size: 14px; }
  li { margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 12px; border: 1px solid #d1d5db; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #d1d5db; }
  tr:nth-child(even) { background: #f9fafb; }
  .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; }
  .red-flag { color: #dc2626; font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <h1>${isUserReport ? `👤 ${entityName} — Employee Activity Report` : "🏭 REBAR SHOP — Daily Operations Report"}</h1>
  <div class="date">${dateStr}</div>
  <div class="subtitle">Generated on ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</div>
</div>

${reportContent}

<div class="footer">
  <p>REBAR SHOP Operations Intelligence — Confidential</p>
  <p>Auto-generated by Vizzy AI • ${dateStr}</p>
</div>
</body>
</html>`;
}
