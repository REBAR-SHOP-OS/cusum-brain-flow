import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check + rate limiting
    const authHeader = req.headers.get("Authorization");
    let rateLimitId = "anonymous";
    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await anonClient.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        rateLimitId = claimsData.claims.sub as string;
      }
    }

    // Rate limit: 5 requests per 60 seconds
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: rateLimitId,
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

    const { date } = await req.json();

    const targetDate = date || new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    // ── Fetch all data sources in parallel ───────────────────────────
    // Fetch profiles for name resolution
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
      emailsRes,
      tasksRes,
      leadsRes,
      ordersRes,
      workOrdersRes,
      deliveriesRes,
      teamMsgsRes,
      meetingsRes,
      rcCallsRes,
      invoicesRes,
      vendorsRes,
      socialPostsRes,
      timeClockRes,
      machineRunsRes,
      eventsRes,
      commandLogRes,
    ] = await Promise.all([
      supabase
        .from("communications")
        .select("from_address, to_address, subject, body_preview, received_at, status, source")
        .eq("source", "gmail")
        .gte("received_at", dayStart)
        .lte("received_at", dayEnd)
        .order("received_at", { ascending: false })
        .limit(50),
      supabase
        .from("tasks")
        .select("title, description, status, priority, due_date, agent_type")
        .or(`created_at.gte.${dayStart},due_date.eq.${targetDate}`)
        .limit(30),
      supabase
        .from("leads")
        .select("title, stage, expected_value, priority, source, expected_close_date")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("orders")
        .select("order_number, status, total_amount, required_date, notes")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .limit(20),
      supabase
        .from("work_orders")
        .select("work_order_number, status, scheduled_start, scheduled_end, workstation, notes")
        .or(`scheduled_start.gte.${dayStart},actual_start.gte.${dayStart}`)
        .limit(20),
      supabase
        .from("deliveries")
        .select("delivery_number, status, scheduled_date, driver_name, notes")
        .eq("scheduled_date", targetDate)
        .limit(20),
      supabase
        .from("team_messages")
        .select("original_text, original_language, sender_profile_id, created_at, channel_id")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("team_meetings")
        .select("title, meeting_type, started_at, ended_at, ai_summary, participants, duration_seconds, status")
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("communications")
        .select("from_address, to_address, subject, body_preview, received_at, status, source, metadata")
        .eq("source", "ringcentral")
        .gte("received_at", dayStart)
        .lte("received_at", dayEnd)
        .order("received_at", { ascending: false })
        .limit(50),
      supabase
        .from("accounting_mirror")
        .select("quickbooks_id, data, balance, last_synced_at")
        .eq("entity_type", "Invoice")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("accounting_mirror")
        .select("quickbooks_id, data, balance")
        .eq("entity_type", "Vendor")
        .limit(20),
      supabase
        .from("social_posts")
        .select("platform, title, content, status, scheduled_date, reach, impressions, likes, comments, shares, clicks, content_type, page_name")
        .gte("scheduled_date", new Date(new Date(targetDate).getTime() - 7 * 86400000).toISOString().split("T")[0])
        .lte("scheduled_date", targetDate)
        .order("scheduled_date", { ascending: false })
        .limit(30),
      // Employee time clock entries
      supabase
        .from("time_clock_entries")
        .select("profile_id, clock_in, clock_out, break_minutes, notes")
        .gte("clock_in", dayStart)
        .lte("clock_in", dayEnd)
        .order("clock_in", { ascending: true }),
      // Machine runs (production activity)
      supabase
        .from("machine_runs")
        .select("operator_profile_id, supervisor_profile_id, process, status, started_at, ended_at, duration_seconds, input_qty, output_qty, scrap_qty, notes, machine_id")
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: false })
        .limit(50),
      // ERP system events (user activity log)
      supabase
        .from("events")
        .select("event_type, entity_type, actor_id, description, created_at")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(100),
      // AI command usage
      supabase
        .from("command_log")
        .select("user_id, parsed_intent, result, created_at")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(50),
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

    // ── Compute QuickBooks summary ───────────────────────────────────
    const totalAR = invoices.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);
    const overdueInvoices = invoices.filter((inv: any) => {
      const dueDate = inv.data?.DueDate;
      return dueDate && dueDate < targetDate && (inv.balance || 0) > 0;
    });
    const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);

    // ── Compute social media summary ─────────────────────────────────
    const totalReach = socialPosts.reduce((sum: number, p: any) => sum + (p.reach || 0), 0);
    const totalImpressions = socialPosts.reduce((sum: number, p: any) => sum + (p.impressions || 0), 0);
    const totalLikes = socialPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0);
    const totalComments = socialPosts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0);
    const totalShares = socialPosts.reduce((sum: number, p: any) => sum + (p.shares || 0), 0);
    const totalClicks = socialPosts.reduce((sum: number, p: any) => sum + (p.clicks || 0), 0);
    const publishedPosts = socialPosts.filter((p: any) => p.status === "published");
    const scheduledPosts = socialPosts.filter((p: any) => p.status === "scheduled");
    const platformBreakdown: Record<string, number> = {};
    publishedPosts.forEach((p: any) => {
      platformBreakdown[p.platform] = (platformBreakdown[p.platform] || 0) + 1;
    });

    // ── Build context for AI ─────────────────────────────────────────
    const dataContext = `
=== DAILY DATA FOR ${targetDate} ===

--- EMAILS (${emails.length} received today) ---
${emails.length > 0
  ? emails.map((e: any, i: number) => `${i + 1}. From: ${e.from_address} | Subject: ${e.subject || "(no subject)"} | Preview: ${(e.body_preview || "").slice(0, 150)}`).join("\n")
  : "No emails received today."
}

--- TASKS (${tasks.length} active/due) ---
${tasks.length > 0
  ? tasks.map((t: any, i: number) => `${i + 1}. [${t.priority || "normal"}] ${t.title} — Status: ${t.status || "pending"}${t.due_date ? ` | Due: ${t.due_date}` : ""}`).join("\n")
  : "No tasks due today."
}

--- SALES PIPELINE (${leads.length} active leads) ---
${leads.length > 0
  ? leads.map((l: any, i: number) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Value: $${l.expected_value || 0} | Priority: ${l.priority || "normal"}`).join("\n")
  : "No active leads."
}

--- ORDERS (${orders.length} new today) ---
${orders.length > 0
  ? orders.map((o: any, i: number) => `${i + 1}. #${o.order_number} — Status: ${o.status} | Amount: $${o.total_amount || 0}`).join("\n")
  : "No new orders today."
}

--- SHOP FLOOR (${workOrders.length} work orders) ---
${workOrders.length > 0
  ? workOrders.map((w: any, i: number) => `${i + 1}. WO#${w.work_order_number} — Status: ${w.status} | Station: ${w.workstation || "unassigned"}`).join("\n")
  : "No work orders scheduled."
}

--- DELIVERIES (${deliveries.length} scheduled) ---
${deliveries.length > 0
  ? deliveries.map((d: any, i: number) => `${i + 1}. ${d.delivery_number} — Status: ${d.status} | Driver: ${d.driver_name || "unassigned"}`).join("\n")
  : "No deliveries scheduled."
}

--- TEAM HUB (${teamMessages.length} messages today) ---
${teamMessages.length > 0
  ? teamMessages.map((m: any, i: number) => `${i + 1}. [${m.original_language}] ${(m.original_text || "").slice(0, 200)}`).join("\n")
  : "No team messages today."
}

--- TEAM MEETINGS (${meetings.length} today) ---
${meetings.length > 0
  ? meetings.map((m: any, i: number) => {
      const dur = m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}min` : "ongoing";
      const participants = (m.participants || []).join(", ") || "N/A";
      return `${i + 1}. ${m.title} (${m.meeting_type}) — ${dur} | Participants: ${participants}${m.ai_summary ? `\n   Summary: ${m.ai_summary}` : ""}`;
    }).join("\n")
  : "No team meetings today."
}

--- RINGCENTRAL CALLS & SMS (${rcCalls.length} today) ---
${rcCalls.length > 0
  ? rcCalls.map((c: any, i: number) => {
      const meta = c.metadata || {};
      const type = meta.type || "call";
      const duration = meta.duration ? `${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s` : "";
      const result = meta.result || "";
      return `${i + 1}. [${type.toUpperCase()}] ${c.subject || ""} | From: ${c.from_address} → To: ${c.to_address}${duration ? ` | Duration: ${duration}` : ""}${result ? ` | Result: ${result}` : ""}`;
    }).join("\n")
  : "No RingCentral calls/SMS today."
}

--- QUICKBOOKS FINANCIALS ---
Total Accounts Receivable: $${totalAR.toFixed(2)}
Overdue Invoices: ${overdueInvoices.length} totaling $${totalOverdue.toFixed(2)}
${overdueInvoices.length > 0
  ? overdueInvoices.slice(0, 10).map((inv: any, i: number) => {
      const d = inv.data || {};
      return `${i + 1}. Invoice #${d.DocNumber || inv.quickbooks_id} | Customer: ${d.CustomerRef?.name || "Unknown"} | Balance: $${inv.balance} | Due: ${d.DueDate || "N/A"}`;
    }).join("\n")
  : ""
}
Total Vendors on file: ${vendors.length}

--- SOCIAL MEDIA (last 7 days) ---
Published Posts: ${publishedPosts.length} | Scheduled: ${scheduledPosts.length}
Platform breakdown: ${Object.entries(platformBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}
Total Reach: ${totalReach.toLocaleString()} | Impressions: ${totalImpressions.toLocaleString()}
Engagement: ${totalLikes} likes, ${totalComments} comments, ${totalShares} shares, ${totalClicks} clicks
${publishedPosts.length > 0
  ? "Top posts:\n" + publishedPosts.slice(0, 5).map((p: any, i: number) => {
      return `${i + 1}. [${p.platform}] ${p.title || (p.content || "").slice(0, 80)} — Reach: ${p.reach || 0} | Likes: ${p.likes || 0} | Clicks: ${p.clicks || 0}`;
    }).join("\n")
  : "No published posts in last 7 days."
}

--- EMPLOYEE TIME CLOCK (${timeEntries.length} entries today) ---
${timeEntries.length > 0
  ? timeEntries.map((t: any, i: number) => {
      const name = profileMap[t.profile_id] || t.profile_id;
      const clockIn = t.clock_in ? new Date(t.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "?";
      const clockOut = t.clock_out ? new Date(t.clock_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "still clocked in";
      const hrs = t.clock_out ? ((new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000).toFixed(1) : "ongoing";
      return `${i + 1}. ${name} — In: ${clockIn} | Out: ${clockOut} | Hours: ${hrs}h${t.break_minutes ? ` | Break: ${t.break_minutes}min` : ""}${t.notes ? ` | Note: ${t.notes}` : ""}`;
    }).join("\n")
  : "No time clock entries today."
}

--- PRODUCTION RUNS (${machineRuns.length} machine runs today) ---
${machineRuns.length > 0
  ? (() => {
      const totalOutput = machineRuns.reduce((s: number, r: any) => s + (r.output_qty || 0), 0);
      const totalScrap = machineRuns.reduce((s: number, r: any) => s + (r.scrap_qty || 0), 0);
      const completedRuns = machineRuns.filter((r: any) => r.status === "completed").length;
      const operatorStats: Record<string, { runs: number; output: number }> = {};
      machineRuns.forEach((r: any) => {
        const name = profileMap[r.operator_profile_id] || "Unknown";
        if (!operatorStats[name]) operatorStats[name] = { runs: 0, output: 0 };
        operatorStats[name].runs++;
        operatorStats[name].output += r.output_qty || 0;
      });
      const opLines = Object.entries(operatorStats).map(([name, s]) => `  • ${name}: ${s.runs} runs, ${s.output} pcs produced`).join("\n");
      const runLines = machineRuns.slice(0, 10).map((r: any, i: number) => {
        const op = profileMap[r.operator_profile_id] || "Unknown";
        return `${i + 1}. [${r.process}] ${op} — Status: ${r.status} | In: ${r.input_qty || 0} → Out: ${r.output_qty || 0} | Scrap: ${r.scrap_qty || 0}`;
      }).join("\n");
      return `Summary: ${completedRuns}/${machineRuns.length} completed | Output: ${totalOutput} pcs | Scrap: ${totalScrap} pcs\nPer operator:\n${opLines}\nRecent runs:\n${runLines}`;
    })()
  : "No production runs today."
}

--- ERP ACTIVITY LOG (${erpEvents.length} events today) ---
${erpEvents.length > 0
  ? (() => {
      const eventsByType: Record<string, number> = {};
      const actorActivity: Record<string, number> = {};
      erpEvents.forEach((e: any) => {
        const key = `${e.event_type}:${e.entity_type}`;
        eventsByType[key] = (eventsByType[key] || 0) + 1;
        const name = profileMap[e.actor_id] || e.actor_id || "system";
        actorActivity[name] = (actorActivity[name] || 0) + 1;
      });
      const eventBreakdown = Object.entries(eventsByType).map(([k, v]) => `${k} (${v})`).join(", ");
      const userBreakdown = Object.entries(actorActivity).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name}: ${count} actions`).join(", ");
      return `Event breakdown: ${eventBreakdown}\nUser activity: ${userBreakdown}`;
    })()
  : "No ERP events logged today."
}

--- AI ASSISTANT USAGE (${commandLogs.length} commands today) ---
${commandLogs.length > 0
  ? (() => {
      const intentCounts: Record<string, number> = {};
      commandLogs.forEach((c: any) => {
        const intent = c.parsed_intent || "unknown";
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      });
      return `Commands: ${Object.entries(intentCounts).map(([k, v]) => `${k} (${v})`).join(", ")}`;
    })()
  : "No AI commands used today."
}
`;

    // ── Call Lovable AI ───────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a smart Daily Digest AI assistant for a steel/rebar manufacturing company called Rebar.shop. 
Generate a structured daily summary digest in JSON format based on real business data provided.

You MUST return valid JSON with this exact structure (no markdown, no code fences):
{
  "greeting": "A warm personalized greeting mentioning the date and day of week",
  "affirmation": "A motivational business affirmation relevant to the day's activities",
  "keyTakeaways": ["Array of 3-6 key business takeaways with emoji, each a concise actionable insight covering the most important areas"],
  "financialSnapshot": {
    "totalAR": "Total accounts receivable amount",
    "overdueCount": "Number of overdue invoices",
    "overdueAmount": "Total overdue amount",
    "highlights": ["2-3 key financial observations or actions needed"],
    "cashFlowNote": "Brief cash flow observation or recommendation"
  },
  "emailCategories": [
    {
      "category": "Category name with emoji",
      "emails": [
        {
          "subject": "Email subject or topic",
          "summary": "Brief summary",
          "action": "Recommended action"
        }
      ]
    }
  ],
  "meetingSummaries": [
    {
      "title": "Meeting title with emoji",
      "type": "video/audio/screen_share",
      "duration": "Duration in minutes",
      "summary": "AI-generated meeting summary",
      "actionItems": ["Action items from meeting"]
    }
  ],
  "phoneCalls": [
    {
      "contact": "Caller/receiver name or number",
      "direction": "Inbound/Outbound",
      "duration": "Call duration",
      "summary": "Brief summary",
      "action": "Follow-up action needed"
    }
  ],
  "socialMediaDigest": {
    "totalReach": "Total reach number",
    "totalEngagement": "Total engagement (likes+comments+shares)",
    "topPlatform": "Best performing platform",
    "highlights": ["2-3 key social media observations"],
    "recommendations": ["1-2 content recommendations based on performance"]
  },
  "employeeReport": {
    "totalClocked": "Number of employees who clocked in",
    "totalHours": "Total hours worked across all employees",
    "highlights": ["Per-employee summary: name, hours, production output if applicable"],
    "concerns": ["Any attendance or productivity concerns"]
  },
  "productionReport": {
    "totalRuns": "Number of machine runs",
    "totalOutput": "Total pieces produced",
    "scrapRate": "Scrap percentage",
    "topOperators": ["Top performing operators with output numbers"],
    "issues": ["Any production issues or bottlenecks noticed"]
  },
  "erpActivity": {
    "totalEvents": "Total ERP events logged",
    "mostActiveUsers": ["Top 3 most active users with action counts"],
    "summary": "Brief summary of what type of ERP activity happened (orders created, status changes, etc.)"
  },
  "calendarEvents": [
    {
      "time": "Suggested time slot",
      "title": "Event/task title with emoji",
      "purpose": "What to do and why"
    }
  ],
  "tipOfTheDay": {
    "title": "Actionable tip title with emoji",
    "steps": ["Step 1", "Step 2", "Step 3"],
    "closing": "Motivational closing with emoji"
  },
  "randomFact": "An interesting random fact about steel, construction, or manufacturing"
}

Rules:
- Group emails by business category (IT/Security, Sales/Operations, Finance/Admin, etc.)
- Prioritize urgent items first
- Include specific numbers, names, and amounts from the data
- Include meeting summaries with key decisions and action items
- Summarize all RingCentral phone calls and SMS with recommended follow-ups
- Provide a clear financial snapshot with overdue invoice alerts
- Analyze social media performance and provide content recommendations
- Summarize each employee's daily activity: hours worked, production runs, key actions
- Flag employees who didn't clock in or had very short shifts
- Highlight top-performing operators by output quantity
- Report ERP system usage patterns and most active users
- If there's little data, still provide useful suggestions and planning tips
- Keep takeaways actionable and concise
- Suggest calendar blocks for follow-ups based on the data
- The financial snapshot should highlight cash flow risks
- Social media digest should identify best performing content types`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate the daily digest for ${targetDate}.\n\n${dataContext}`,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response (strip markdown fences if present)
    let digest;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      digest = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse AI digest response");
    }

    return new Response(
      JSON.stringify({
        digest,
        stats: {
          emails: emails.length,
          tasks: tasks.length,
          leads: leads.length,
          orders: orders.length,
          workOrders: workOrders.length,
          deliveries: deliveries.length,
          teamMessages: teamMessages.length,
          meetings: meetings.length,
          phoneCalls: rcCalls.length,
          invoices: invoices.length,
          overdueInvoices: overdueInvoices.length,
          socialPosts: publishedPosts.length,
          employeesClocked: timeEntries.length,
          machineRuns: machineRuns.length,
          erpEvents: erpEvents.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily summary error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
