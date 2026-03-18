/**
 * Shared server-side context builder for Vizzy JARVIS mode.
 * Used by admin-chat, vizzy-daily-brief, and vizzy-context edge functions.
 * Limited to 50 knowledge entries and 50-char email previews for performance.
 */
export interface VizzyContextOptions {
  includeFinancials?: boolean;
}

export async function buildFullVizzyContext(
  supabase: any,
  userId: string,
  options: VizzyContextOptions = {}
): Promise<string> {
  const { includeFinancials = true } = options;
  const today = new Date().toISOString().split("T")[0];
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // --- Cached queries (slow-changing data) ---
  const { cachedQuery } = await import("./cache.ts");

  const [machines, totalCustomers, stockSummary, profiles, knowledge] = await Promise.all([
    cachedQuery("vizzy:machines", 5 * 60_000, async () => {
      const { data } = await supabase
        .from("machines")
        .select("id, name, status, type, current_operator_profile_id")
        .limit(20);
      return data;
    }),
    cachedQuery("vizzy:customerCount", 10 * 60_000, async () => {
      const { count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      return count;
    }),
    cachedQuery("vizzy:stock", 2 * 60_000, async () => {
      const { data } = await supabase
        .from("inventory_lots")
        .select("bar_code, qty_on_hand, location")
        .gt("qty_on_hand", 0)
        .limit(15);
      return data;
    }),
    cachedQuery("vizzy:profiles", 5 * 60_000, async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, user_id, email")
        .not("full_name", "is", null);
      return data;
    }),
    cachedQuery("vizzy:knowledge", 10 * 60_000, async () => {
      const { data } = await supabase
        .from("knowledge")
        .select("title, category, content")
        .order("created_at", { ascending: false })
        .limit(50);
      return data;
    }),
  ]);

  // --- Uncached queries (realtime data) ---
  const [
    { count: activeOrders },
    { data: recentEvents },
    { data: pendingSuggestions },
    { data: cutPlans },
    { data: cutItems },
    { data: leads },
    { data: deliveries },
    { data: accountingInv },
    { data: accountingBill },
    { data: communications },
    { data: allEmailsToday },
    { data: agentSessions },
    { data: timeClockEntries },
    { data: memories },
    { data: workOrdersToday },
    { data: agentActions },
    { data: machineOps },
    { data: employeeEvents },
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]),
    supabase
      .from("activity_events")
      .select("event_type, entity_type, description, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("suggestions")
      .select("title, suggestion_type, priority, status")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .limit(5),
    supabase
      .from("cut_plans")
      .select("id, name, status")
      .in("status", ["queued", "running"]),
    supabase
      .from("cut_plan_items")
      .select("id, phase, completed_pieces, total_pieces, bend_type, bar_code")
      .in("phase", ["queued", "cutting", "bending"])
      .limit(500),
    supabase
      .from("leads")
      .select("id, title, customer_id, stage, expected_value, win_prob_score, priority_score")
      .not("stage", "in", '("won","lost","loss","cancelled")')
      .order("win_prob_score", { ascending: false })
      .limit(20),
    supabase
      .from("deliveries")
      .select("id, delivery_number, status, scheduled_date")
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .limit(50),
    includeFinancials
      ? supabase
          .from("accounting_mirror")
          .select("balance, entity_type, data")
          .eq("entity_type", "Invoice")
          .gt("balance", 0)
          .limit(50)
      : Promise.resolve({ data: null }),
    includeFinancials
      ? supabase
          .from("accounting_mirror")
          .select("balance, entity_type, data")
          .eq("entity_type", "Vendor")
          .gt("balance", 0)
          .limit(50)
      : Promise.resolve({ data: null }),
    supabase
      .from("communications")
      .select("subject, from_address, to_address, body_preview, received_at, ai_urgency")
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(30),
    supabase
      .from("communications")
      .select("from_address, to_address, direction, received_at, gmail_thread_id")
      .gte("received_at", today + "T00:00:00")
      .order("received_at", { ascending: false })
      .limit(500),
    supabase
      .from("chat_sessions")
      .select("id, title, agent_name, user_id, created_at")
      .gte("created_at", today + "T00:00:00")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out")
      .gte("clock_in", today + "T00:00:00")
      .order("clock_in", { ascending: false })
      .limit(100),
    supabase
      .from("vizzy_memory")
      .select("id, category, content, metadata, created_at, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    // Employee performance: work orders with assignees today
    supabase
      .from("work_orders")
      .select("id, work_order_number, status, assigned_to, actual_start, actual_end")
      .gte("updated_at", today + "T00:00:00")
      .limit(200),
    // Employee performance: agent actions today
    supabase
      .from("agent_action_log")
      .select("user_id, action_type, entity_type, created_at")
      .gte("created_at", today + "T00:00:00")
      .order("created_at", { ascending: false })
      .limit(200),
    // Machine operators currently assigned
    supabase
      .from("machines")
      .select("id, name, status, current_operator_profile_id")
      .not("current_operator_profile_id", "is", null),
    // Employee activity events today (for per-employee action counts)
    supabase
      .from("activity_events")
      .select("actor_id, event_type, entity_type, created_at")
      .gte("created_at", today + "T00:00:00")
      .not("actor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // Compute financials
  const invoices = (accountingInv || []).map((r: any) => ({
    Balance: r.balance,
    DueDate: r.data?.DueDate || null,
    CustomerRef: r.data?.CustomerRef || null,
  }));
  const bills = (accountingBill || []).map((r: any) => ({
    Balance: r.balance,
    DueDate: r.data?.DueDate || null,
    VendorRef: r.data?.VendorRef || null,
  }));

  const overdueInvoices = invoices.filter(
    (inv: any) => inv.Balance > 0 && inv.DueDate && inv.DueDate < today
  );
  const overdueBills = bills.filter(
    (b: any) => b.Balance > 0 && b.DueDate && b.DueDate < today
  );
  const totalReceivable = invoices.reduce(
    (s: number, i: any) => s + (i.Balance || 0),
    0
  );
  const totalPayable = bills.reduce(
    (s: number, b: any) => s + (b.Balance || 0),
    0
  );

  const topOverdueCustomers = overdueInvoices
    .slice(0, 5)
    .map(
      (inv: any) =>
        `  • ${inv.CustomerRef?.name || "Unknown"}: ${fmt(inv.Balance)} (due ${inv.DueDate})`
    )
    .join("\n");

  const topOverdueVendors = overdueBills
    .slice(0, 5)
    .map(
      (b: any) =>
        `  • ${b.VendorRef?.name || "Unknown"}: ${fmt(b.Balance)} (due ${b.DueDate})`
    )
    .join("\n");

  // Production stats
  const activeCutPlans = (cutPlans || []).length;
  const queuedItems = (cutItems || []).length;
  const completedToday = (cutItems || []).filter(
    (i: any) =>
      (i.completed_pieces ?? 0) >= (i.total_pieces ?? 0) && (i.total_pieces ?? 0) > 0
  ).length;
  const machinesRunning = (machines || []).filter(
    (m: any) => m.status === "running"
  ).length;

  // CRM
  const openLeads = (leads || []).length;
  const hotLeads = (leads || [])
    .filter((l: any) => (l.win_prob_score || 0) >= 70)
    .slice(0, 5)
    .map(
      (l: any) =>
        `  • ${l.title} — Win prob: ${l.win_prob_score}%, Expected: ${fmt(l.expected_value || 0)}`
    )
    .join("\n");

  // Team
  const totalStaff = (profiles || []).length;
  const profileIdMap = new Map(
    (profiles || []).map((p: any) => [p.id, p.full_name || "Unknown"])
  );

  // Time clock
  const clockEntries = (timeClockEntries || []) as any[];
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  const onNow = clockEntries.filter((t: any) => !t.clock_out);
  const doneToday = clockEntries.filter((t: any) => !!t.clock_out);
  const presenceLines: string[] = [];
  if (onNow.length > 0) {
    presenceLines.push("  Currently Clocked In:");
    onNow.forEach((t: any) =>
      presenceLines.push(
        `    • ${profileIdMap.get(t.profile_id) || "Unknown"} — since ${fmtTime(t.clock_in)}`
      )
    );
  }
  if (doneToday.length > 0) {
    presenceLines.push("  Clocked Out Today:");
    doneToday.forEach((t: any) => {
      const hrs = (
        (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) /
        3600000
      ).toFixed(1);
      presenceLines.push(
        `    • ${profileIdMap.get(t.profile_id) || "Unknown"} — ${fmtTime(t.clock_in)} to ${fmtTime(t.clock_out)} (${hrs} hrs)`
      );
    });
  }

  // Events
  const eventsList = (recentEvents || [])
    .slice(0, 15)
    .map(
      (e: any) =>
        `  • [${e.event_type}] ${e.entity_type}: ${e.description || "No description"}`
    )
    .join("\n");

  // Emails — truncated to 50 chars for performance
  const emailsList = (communications || [])
    .slice(0, 20)
    .map((e: any) => {
      const preview = e.body_preview
        ? e.body_preview.slice(0, 50).replace(/\n/g, " ")
        : "";
      const date = e.received_at
        ? new Date(e.received_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "unknown";
      return `  • [${e.subject || "No subject"}] from ${e.from_address || "unknown"} — ${preview} (${date})`;
    })
    .join("\n");

  // Knowledge base — limited to 50 entries with truncated content
  const totalKnowledge = (knowledge || []).length;
  const brainList = (knowledge || [])
    .map((k: any) => {
      const content = k.content
        ? k.content.replace(/\n/g, " ").slice(0, 150)
        : "(no content)";
      return `  • [${k.category}] ${k.title}: ${content}`;
    })
    .join("\n");

  // Suggestions
  const suggestionsList = (pendingSuggestions || [])
    .map(
      (s: any) => `  • [${s.priority}] ${s.title} (${s.suggestion_type})`
    )
    .join("\n");

  // Deliveries
  const scheduledToday = (deliveries || []).length;
  const inTransit = (deliveries || []).filter(
    (d: any) => d.status === "in-transit"
  ).length;

  // Memories
  const activeMemories = (memories || []).filter(
    (m: any) => !m.expires_at || new Date(m.expires_at) > new Date()
  );
  const memorySection = activeMemories.length > 0
    ? activeMemories
        .map(
          (m: any) =>
            `  • [${m.category}] ${m.content}${m.expires_at ? ` (expires ${new Date(m.expires_at).toLocaleDateString()})` : ""}`
        )
        .join("\n")
    : "  No saved memories yet";

  // ═══ EMPLOYEE PERFORMANCE (aggregated from real data) ═══
  const profileUserIdMap = new Map(
    (profiles || []).map((p: any) => [p.user_id, p.full_name || "Unknown"])
  );

  // Work order performance per employee today
  const woByAssignee: Record<string, { total: number; completed: number; inProgress: number }> = {};
  for (const wo of (workOrdersToday || [])) {
    const assignee = wo.assigned_to;
    if (!assignee) continue;
    const name = profileIdMap.get(assignee) || "Unknown";
    if (!woByAssignee[name]) woByAssignee[name] = { total: 0, completed: 0, inProgress: 0 };
    woByAssignee[name].total++;
    if (wo.status === "completed" || wo.status === "done") woByAssignee[name].completed++;
    if (wo.status === "in_progress" || wo.status === "in-progress") woByAssignee[name].inProgress++;
  }
  const woPerformanceLines = Object.entries(woByAssignee)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, stats]) =>
      `  • ${name}: ${stats.total} WOs (${stats.completed} done, ${stats.inProgress} active)`
    )
    .join("\n");

  // Agent usage per employee today (from chat_sessions)
  const agentUsageByUser: Record<string, { sessions: number; agents: Set<string>; lastTopic: string }> = {};
  for (const s of (agentSessions || [])) {
    const name = profileUserIdMap.get(s.user_id) || "Unknown";
    if (!agentUsageByUser[name]) agentUsageByUser[name] = { sessions: 0, agents: new Set(), lastTopic: "" };
    agentUsageByUser[name].sessions++;
    agentUsageByUser[name].agents.add(s.agent_name);
    if (!agentUsageByUser[name].lastTopic) agentUsageByUser[name].lastTopic = s.title || "";
  }
  const agentUsageLines = Object.entries(agentUsageByUser)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .map(([name, u]) =>
      `  • ${name}: ${u.sessions} sessions across ${Array.from(u.agents).join(", ")}${u.lastTopic ? ` (last: "${u.lastTopic}")` : ""}`
    )
    .join("\n");

  // Agent actions per user today
  const actionsByUser: Record<string, { count: number; types: Set<string> }> = {};
  for (const a of (agentActions || [])) {
    const name = profileUserIdMap.get(a.user_id) || "Unknown";
    if (!actionsByUser[name]) actionsByUser[name] = { count: 0, types: new Set() };
    actionsByUser[name].count++;
    actionsByUser[name].types.add(a.action_type);
  }
  const actionsLines = Object.entries(actionsByUser)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, a]) =>
      `  • ${name}: ${a.count} actions (${Array.from(a.types).slice(0, 4).join(", ")})`
    )
    .join("\n");

  // Machine operators currently active
  const operatorLines = (machineOps || [])
    .map((m: any) => `  • ${profileIdMap.get(m.current_operator_profile_id) || "Unknown"} → ${m.name} [${m.status}]`)
    .join("\n");

  // Hours worked today per employee
  const hoursWorked: Record<string, number> = {};
  for (const t of clockEntries) {
    const name = profileIdMap.get(t.profile_id) || "Unknown";
    const clockOut = t.clock_out ? new Date(t.clock_out).getTime() : Date.now();
    const hrs = (clockOut - new Date(t.clock_in).getTime()) / 3600000;
    hoursWorked[name] = (hoursWorked[name] || 0) + hrs;
  }
  const hoursLines = Object.entries(hoursWorked)
    .sort((a, b) => b[1] - a[1])
    .map(([name, hrs]) => `  • ${name}: ${hrs.toFixed(1)} hrs`)
    .join("\n");

  // ═══ EMAIL BIRD'S-EYE VIEW (per employee) ═══
  const emailProfileMap = new Map(
    (profiles || []).map((p: any) => [p.email?.toLowerCase(), p.full_name || "Unknown"])
  );
  const emailsByEmployee: Record<string, { sent: number; received: number }> = {};
  for (const e of (allEmailsToday || [])) {
    if (e.direction === "outbound") {
      const fromEmail = e.from_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
      const name = emailProfileMap.get(fromEmail) || fromEmail;
      if (!emailsByEmployee[name]) emailsByEmployee[name] = { sent: 0, received: 0 };
      emailsByEmployee[name].sent++;
    } else {
      const toEmail = e.to_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
      const name = emailProfileMap.get(toEmail) || toEmail;
      if (!emailsByEmployee[name]) emailsByEmployee[name] = { sent: 0, received: 0 };
      emailsByEmployee[name].received++;
    }
  }
  const totalOutbound = (allEmailsToday || []).filter((e: any) => e.direction === "outbound").length;
  const totalInbound = (allEmailsToday || []).filter((e: any) => e.direction === "inbound").length;

  // Unanswered inbound: threads with inbound but no outbound today
  const inboundThreads = new Set((allEmailsToday || []).filter((e: any) => e.direction === "inbound" && e.gmail_thread_id).map((e: any) => e.gmail_thread_id));
  const outboundThreads = new Set((allEmailsToday || []).filter((e: any) => e.direction === "outbound" && e.gmail_thread_id).map((e: any) => e.gmail_thread_id));
  const unansweredCount = [...inboundThreads].filter((t) => !outboundThreads.has(t)).length;

  const emailByEmployeeLines = Object.entries(emailsByEmployee)
    .sort((a, b) => (b[1].sent + b[1].received) - (a[1].sent + a[1].received))
    .map(([name, stats]) => `  • ${name}: ${stats.sent} sent, ${stats.received} received`)
    .join("\n");

  // ═══ EMPLOYEE ACTIVITY EVENT COUNTS (per employee) ═══
  const eventsByEmployee: Record<string, { count: number; types: Set<string> }> = {};
  for (const ev of (employeeEvents || [])) {
    const name = profileUserIdMap.get(ev.actor_id) || "Unknown";
    if (!eventsByEmployee[name]) eventsByEmployee[name] = { count: 0, types: new Set() };
    eventsByEmployee[name].count++;
    eventsByEmployee[name].types.add(ev.event_type);
  }
  const employeeEventLines = Object.entries(eventsByEmployee)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stats]) => `  • ${name}: ${stats.count} actions (${Array.from(stats.types).slice(0, 5).join(", ")})`)
    .join("\n");

  return `═══ LIVE BUSINESS SNAPSHOT (${new Date().toLocaleString()}) ═══

${includeFinancials ? `📊 FINANCIALS
  Accounts Receivable: ${fmt(totalReceivable)}
  Accounts Payable: ${fmt(totalPayable)}
  Overdue Invoices: ${overdueInvoices.length} totaling ${fmt(overdueInvoices.reduce((s: number, i: any) => s + i.Balance, 0))}
${topOverdueCustomers || "    None"}
  Overdue Bills: ${overdueBills.length} totaling ${fmt(overdueBills.reduce((s: number, b: any) => s + b.Balance, 0))}
${topOverdueVendors || "    None"}` : `📊 FINANCIALS
  Restricted — requires admin access`}

🏭 PRODUCTION
  Active Cut Plans: ${activeCutPlans}
  Items in Queue: ${queuedItems}
  Completed Today: ${completedToday}
  Machines Running: ${machinesRunning}
  Active Work Orders: ${activeOrders ?? 0}

📈 SALES PIPELINE
  Open Leads: ${openLeads}
  Hot Leads (score ≥70):
${hotLeads || "    None"}

👥 CUSTOMERS
  Total Active: ${totalCustomers ?? 0}

🚚 DELIVERIES TODAY
  Scheduled: ${scheduledToday}
  In Transit: ${inTransit}

👷 TEAM (${totalStaff} staff)

⏱️ TEAM PRESENCE & HOURS TODAY
${presenceLines.length > 0 ? presenceLines.join("\n") : "  No time clock entries today"}
${hoursLines ? `\n  Hours Worked Today:\n${hoursLines}` : ""}

📊 EMPLOYEE PERFORMANCE (TODAY — REAL DATA)
  Work Order Activity:
${woPerformanceLines || "    No work orders with assignees today"}
  Machine Operators Active:
${operatorLines || "    No operators currently assigned"}
  AI Agent Usage by Employee:
${agentUsageLines || "    No agent sessions today"}
  Agent Actions by Employee:
${actionsLines || "    No agent actions today"}
  All Logged Actions by Employee:
${employeeEventLines || "    No activity events today"}

📧 EMAIL BIRD'S-EYE VIEW (TODAY)
  Total Inbound: ${totalInbound} | Total Outbound: ${totalOutbound}
  Unanswered Threads: ${unansweredCount}
  Per-Employee Email Activity:
${emailByEmployeeLines || "    No email activity today"}

📋 RECENT ACTIVITY
${eventsList || "  No recent events"}

📧 EMAIL INBOX (last ${(communications || []).length} emails)
${emailsList || "  No emails available"}

💡 PENDING SUGGESTIONS
${suggestionsList || "  None"}

📦 STOCK SUMMARY
${(stockSummary || []).map((s: any) => `  • ${s.bar_code}: ${s.qty_on_hand} @ ${s.location || "unknown"}`).join("\n") || "  No stock data"}

🧠 KNOWLEDGE BASE (${totalKnowledge} entries, showing latest 50)
${brainList || "  No entries"}

🧠 PERSISTENT MEMORY (${activeMemories.length} items)
${memorySection}`;
}
