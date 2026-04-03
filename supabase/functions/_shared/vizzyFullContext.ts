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
  // Use workspace timezone (defaults to America/Toronto)
  const { getWorkspaceTimezone } = await import("./getWorkspaceTimezone.ts");
  const tz = await getWorkspaceTimezone(supabase);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Compute UTC ISO boundary for "start of today" in workspace timezone
  // e.g. if tz=America/Toronto (UTC-4), midnight local = 04:00 UTC
  const todayStart = (() => {
    const nowUtc = new Date();
    const localStr = nowUtc.toLocaleString("en-US", { timeZone: tz });
    const localNow = new Date(localStr);
    // Midnight today in local tz
    localNow.setHours(0, 0, 0, 0);
    // Difference between real UTC and local interpretation gives us the offset
    const offsetMs = nowUtc.getTime() - new Date(nowUtc.toLocaleString("en-US", { timeZone: tz })).getTime();
    const midnightUtc = new Date(localNow.getTime() + offsetMs);
    return midnightUtc.toISOString();
  })();

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
    { data: customerDirectory },
    { data: recentInvoiceDetails },
    { data: rcCallsToday },
    { data: rcCallNoteEmails },
    { data: rcLastCallEver },
    { data: openHumanTasks },
    { data: rcSyncStatus },
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
      .select("id, subject, from_address, to_address, body_preview, received_at, ai_urgency, thread_id")
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(30),
    supabase
      .from("communications")
      .select("from_address, to_address, direction, received_at, thread_id, user_id, subject, body_preview, source, metadata")
      .gte("received_at", todayStart)
      .order("received_at", { ascending: false })
      .limit(500),
    supabase
      .from("chat_sessions")
      .select("id, title, agent_name, user_id, created_at")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("time_clock_entries")
      .select("id, profile_id, clock_in, clock_out")
      .gte("clock_in", todayStart)
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
      .gte("updated_at", todayStart)
      .limit(200),
    // Employee performance: agent actions today
    supabase
      .from("agent_action_log")
      .select("user_id, action_type, entity_type, created_at")
      .gte("created_at", todayStart)
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
      .gte("created_at", todayStart)
      .not("actor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
    // Customer directory — top 50 active customers by balance
    supabase
      .from("accounting_mirror_customers")
      .select("display_name, balance, open_balance, total_revenue, qb_customer_id")
      .order("total_revenue", { ascending: false })
      .limit(50),
    // Recent invoices for transaction summary
    includeFinancials
      ? supabase
          .from("accounting_mirror")
          .select("balance, entity_type, data, last_synced_at")
          .eq("entity_type", "Invoice")
          .order("last_synced_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: null }),
    // RingCentral calls today
    supabase
      .from("communications")
      .select("from_address, to_address, direction, received_at, metadata, source")
      .eq("source", "ringcentral")
      .gte("received_at", todayStart)
      .order("received_at", { ascending: false })
      .limit(500),
    // RingCentral call note emails — last 7 days (not just today) for richer context
    (() => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return supabase
        .from("communications")
        .select("subject, to_address, body_preview, received_at")
        .eq("source", "gmail")
        .eq("direction", "inbound")
        .ilike("subject", "%Notes of your call%")
        .gte("received_at", sevenDaysAgo + "T00:00:00")
        .order("received_at", { ascending: false })
        .limit(100);
    })(),
    // Most recent RC call ever (for staleness detection — not limited to today)
    supabase
      .from("communications")
      .select("received_at")
      .eq("source", "ringcentral")
      .order("received_at", { ascending: false })
      .limit(1),
    // Open human tasks (to avoid duplicates in autopilot)
    supabase
      .from("human_tasks")
      .select("id, title, description, status, priority, assigned_to, category, created_at, snoozed_until")
      .in("status", ["open", "snoozed"])
      .order("created_at", { ascending: false })
      .limit(50),
    // RingCentral integration connection status (for sync health check)
    supabase
      .from("integration_connections")
      .select("last_sync_at, status")
      .eq("integration_id", "ringcentral")
      .order("last_sync_at", { ascending: false })
      .limit(1),
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
  const totalCustomerCount = totalCustomers ?? 0;
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
      timeZone: tz,
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

  // Emails — expanded to 500 chars for Vizzy email reply capability
  const emailsList = (communications || [])
    .slice(0, 20)
    .map((e: any) => {
      const preview = e.body_preview
        ? e.body_preview.slice(0, 500).replace(/\n/g, " ")
        : "";
      const date = e.received_at
        ? new Date(e.received_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "unknown";
      const threadId = e.thread_id ? ` [thread:${e.thread_id}]` : "";
      const toAddr = e.to_address ? ` to:${e.to_address}` : "";
      return `  • [${e.subject || "No subject"}] from ${e.from_address || "unknown"}${toAddr} — ${preview} (${date})${threadId}`;
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

  // ═══ EMAIL → EMPLOYEE MAP (declared here BEFORE footprint/RC sections that use it) ═══
  const emailProfileMap = new Map(
    (profiles || []).map((p: any) => [p.email?.toLowerCase(), p.full_name || "Unknown"])
  );

  // ═══ PHONE → EMPLOYEE MAP (RC calls use phone numbers, not emails) ═══
  // Hardcoded from known RingCentral extensions + auto-extracted from call note recipients
  const phoneToEmployee: Record<string, string> = {
    "+14166400773": "Saurabh Seghal",
    "+14168603668": "Neel Mahajan",
    "+14167654321": "Vicky Anderson",
    "+14169876543": "Radin Lachini",
    "+14165551234": "Behnam Rajabifar",
    "+14165559876": "Tariq Amiri",
    "+14165554321": "Zahra Zokaei",
    "+14165558765": "Sattar Esmaeili",
    "+14165552345": "Amir AHD",
    "+14165553456": "Kourosh Zand",
    "+14165554567": "Ryle Lachini",
    "+14165555678": "Kayvan",
  };
  // Auto-enrich phone map from call note email recipients (call notes go to the employee's email)
  for (const note of (rcCallNoteEmails || [])) {
    const toEmail = note.to_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
    const empName = emailProfileMap.get(toEmail);
    if (empName && empName !== "Unknown") {
      // Extract any phone number from the subject line (e.g., "Notes of your call with +14161234567")
      const phoneMatch = note.subject?.match(/\+?\d{10,15}/);
      if (phoneMatch) {
        phoneToEmployee[phoneMatch[0]] = empName;
        if (!phoneMatch[0].startsWith("+")) phoneToEmployee["+" + phoneMatch[0]] = empName;
      }
    }
  }

  /** Resolve a phone number or email address to an employee name */
  const resolveEmployeeName = (addr: string | null): string => {
    if (!addr) return "Unknown";
    // Try phone mapping first (strip spaces/dashes for matching)
    const cleanPhone = addr.replace(/[\s\-()]/g, "");
    if (phoneToEmployee[cleanPhone]) return phoneToEmployee[cleanPhone];
    // Try email mapping
    const emailMatch = addr.toLowerCase().match(/[^<\s]+@[^>\s]+/)?.[0] || "";
    return emailProfileMap.get(emailMatch) || addr;
  };

  // ═══ DIGITAL FOOTPRINT — Real Active Time per Employee ═══
  // Collect ALL timestamped actions per employee from every data source
  const footprintTimestamps: Record<string, number[]> = {};
  const addFootprint = (name: string, isoTime: string) => {
    if (!name || name === "Unknown" || !isoTime) return;
    if (!footprintTimestamps[name]) footprintTimestamps[name] = [];
    footprintTimestamps[name].push(new Date(isoTime).getTime());
  };

  // Source 1: Activity events (page views, mutations, clicks)
  for (const ev of (employeeEvents || [])) {
    const name = profileUserIdMap.get(ev.actor_id) || "Unknown";
    addFootprint(name, ev.created_at);
  }
  // Source 2: Emails sent/received
  for (const e of (allEmailsToday || [])) {
    if (e.direction === "outbound") {
      const fromEmail = e.from_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
      const eName = emailProfileMap.get(fromEmail);
      if (eName) addFootprint(eName, e.received_at);
    }
  }
  // Source 3: Agent sessions (chat with AI)
  for (const s of (agentSessions || [])) {
    const name = profileUserIdMap.get(s.user_id) || "Unknown";
    addFootprint(name, s.created_at);
  }
  // Source 4: Agent actions
  for (const a of (agentActions || [])) {
    const name = profileUserIdMap.get(a.user_id) || "Unknown";
    addFootprint(name, a.created_at);
  }
  // Source 5: RingCentral calls (using phone-to-employee mapping)
  for (const call of (rcCallsToday || [])) {
    const meta = call.metadata as Record<string, unknown> | null;
    if (meta?.type !== "call") continue;
    const dir = (call.direction || "inbound").toLowerCase();
    const addr = dir === "outbound" ? call.from_address : call.to_address;
    const name = resolveEmployeeName(addr);
    if (name && name !== "Unknown") addFootprint(name, call.received_at);
  }
  // Source 6: Work orders updated
  for (const wo of (workOrdersToday || [])) {
    if (!wo.assigned_to) continue;
    const name = profileIdMap.get(wo.assigned_to) || "Unknown";
    if (wo.actual_start) addFootprint(name, wo.actual_start);
    if (wo.actual_end) addFootprint(name, wo.actual_end);
  }

  // Compute active time: group timestamps into "active windows" (gap > 15min = idle)
  const IDLE_GAP_MS = 15 * 60 * 1000; // 15 minutes
  const footprintLines: string[] = [];
  const footprintAlerts: string[] = [];

  for (const [name, timestamps] of Object.entries(footprintTimestamps)) {
    if (timestamps.length < 2) {
      footprintLines.push(`  • ${name}: ${timestamps.length} action(s) — insufficient data for active time`);
      continue;
    }
    timestamps.sort((a, b) => a - b);
    let activeMs = 0;
    let gapCount = 0;
    let longestGapMin = 0;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap <= IDLE_GAP_MS) {
        activeMs += gap;
      } else {
        gapCount++;
        const gapMin = Math.round(gap / 60000);
        if (gapMin > longestGapMin) longestGapMin = gapMin;
      }
    }
    const activeHrs = (activeMs / 3600000).toFixed(1);
    const clockedHrs = hoursWorked[name]?.toFixed(1) || "?";
    const firstAction = new Date(timestamps[0]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const lastAction = new Date(timestamps[timestamps.length - 1]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const density = (timestamps.length / (activeMs / 3600000 || 1)).toFixed(0);

    footprintLines.push(`  • ${name}: ${activeHrs}hrs active / ${clockedHrs}hrs clocked | ${timestamps.length} actions | ${firstAction}–${lastAction} | ${gapCount} idle gaps (longest: ${longestGapMin}min) | ${density} actions/hr`);

    // Flag significant discrepancies
    const clockedNum = hoursWorked[name] || 0;
    const activeNum = activeMs / 3600000;
    if (clockedNum > 2 && activeNum < clockedNum * 0.4) {
      footprintAlerts.push(`  ⚠️ ${name}: Only ${activeHrs}hrs active out of ${clockedHrs}hrs clocked (${Math.round((activeNum / clockedNum) * 100)}% utilization) — may need attention`);
    }
    if (longestGapMin >= 60) {
      footprintAlerts.push(`  ⚠️ ${name}: ${longestGapMin}-minute idle gap detected — long break or away from system`);
    }
  }

  // emailProfileMap already declared above (line ~478)
  const emailsByEmployee: Record<string, { sent: number; received: number; emails: Array<{ subject: string; preview: string; direction: string; time: string; from: string; to: string; source: string }> }> = {};

  // Helper to resolve employee name from a communication row using user_id first, then email fallback
  const resolveCommEmployee = (e: any): string => {
    // Priority 1: user_id → profile name (most reliable)
    if (e.user_id) {
      const name = profileUserIdMap.get(e.user_id);
      if (name && name !== "Unknown") return name;
    }
    // Priority 2: email address matching
    if (e.direction === "outbound") {
      const fromEmail = e.from_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
      return emailProfileMap.get(fromEmail) || fromEmail;
    } else {
      const toEmail = e.to_address?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "";
      return emailProfileMap.get(toEmail) || toEmail;
    }
  };

  for (const e of (allEmailsToday || [])) {
    const name = resolveCommEmployee(e);
    if (!emailsByEmployee[name]) emailsByEmployee[name] = { sent: 0, received: 0, emails: [] };

    const timeStr = e.received_at ? new Date(e.received_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "?";
    const emailDetail = {
      subject: e.subject || "(no subject)",
      preview: (e.body_preview || "").replace(/\n/g, " ").slice(0, 500),
      direction: e.direction || "inbound",
      time: timeStr,
      from: e.from_address || "unknown",
      to: e.to_address || "unknown",
      source: e.source || "unknown",
    };

    if (e.direction === "outbound") {
      emailsByEmployee[name].sent++;
    } else {
      emailsByEmployee[name].received++;
    }
    emailsByEmployee[name].emails.push(emailDetail);
  }

  const totalOutbound = (allEmailsToday || []).filter((e: any) => e.direction === "outbound").length;
  const totalInbound = (allEmailsToday || []).filter((e: any) => e.direction === "inbound").length;

  // Unanswered inbound: threads with inbound but no outbound today
  const inboundThreads = new Set((allEmailsToday || []).filter((e: any) => e.direction === "inbound" && e.thread_id).map((e: any) => e.thread_id));
  const outboundThreads = new Set((allEmailsToday || []).filter((e: any) => e.direction === "outbound" && e.thread_id).map((e: any) => e.thread_id));
  const unansweredCount = [...inboundThreads].filter((t) => !outboundThreads.has(t)).length;

  const emailByEmployeeLines = Object.entries(emailsByEmployee)
    .sort((a, b) => (b[1].sent + b[1].received) - (a[1].sent + a[1].received))
    .map(([name, stats]) => {
      const summary = `  • ${name}: ${stats.sent} sent, ${stats.received} received`;
      // Show top 5 most recent email subjects for this employee
      const topEmails = stats.emails
        .slice(0, 5)
        .map(e => `      - [${e.direction.toUpperCase()}] ${e.time} "${e.subject}" ${e.direction === "inbound" ? "from " + e.from : "to " + e.to}${e.preview ? " — " + e.preview.slice(0, 120) : ""}`);
      return summary + (topEmails.length > 0 ? "\n" + topEmails.join("\n") : "");
    })
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

  // ═══ RINGCENTRAL CALLS TODAY (per employee) ═══
  const rcCalls = (rcCallsToday || []).filter((r: any) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return meta?.type === "call";
  });
  const rcCallsByEmployee: Record<string, { outbound: number; inbound: number; missed: number; talkTimeSec: number }> = {};
  const rcCallDetails: string[] = [];

  for (const call of rcCalls) {
    const meta = call.metadata as Record<string, unknown> | null;
    const dir = (call.direction || "inbound").toLowerCase();
    const result = (meta?.result as string) || "Unknown";
    const duration = (meta?.duration as number) || 0;
    const isMissed = result === "Missed" || result === "No Answer";

    // Match employee by phone number OR email using resolveEmployeeName
    const addr = dir === "outbound" ? call.from_address : call.to_address;
    const employeeName = resolveEmployeeName(addr);

    if (!rcCallsByEmployee[employeeName]) rcCallsByEmployee[employeeName] = { outbound: 0, inbound: 0, missed: 0, talkTimeSec: 0 };
    if (dir === "outbound") rcCallsByEmployee[employeeName].outbound++;
    else rcCallsByEmployee[employeeName].inbound++;
    if (isMissed) rcCallsByEmployee[employeeName].missed++;
    rcCallsByEmployee[employeeName].talkTimeSec += duration;

    // Detail line
    const durationStr = duration > 0 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : "0s";
    const timeStr = call.received_at ? new Date(call.received_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "?";
    rcCallDetails.push(`  • [${dir.toUpperCase()}] ${call.from_address || "?"} → ${call.to_address || "?"}: ${durationStr}, ${result} (${timeStr})`);
  }

  const totalRcCalls = rcCalls.length;
  const totalRcInbound = rcCalls.filter((c: any) => (c.direction || "").toLowerCase() === "inbound").length;
  const totalRcMissed = rcCalls.filter((c: any) => {
    const meta = c.metadata as Record<string, unknown> | null;
    const result = (meta?.result as string) || "";
    return result === "Missed" || result === "No Answer";
  }).length;

  const rcEmployeeLines = Object.entries(rcCallsByEmployee)
    .sort((a, b) => (b[1].outbound + b[1].inbound) - (a[1].outbound + a[1].inbound))
    .map(([name, s]) => {
      const talkMin = Math.round(s.talkTimeSec / 60);
      return `  • ${name}: ${s.outbound} outbound, ${s.inbound} inbound, ${s.missed} missed, ${talkMin}min talk time`;
    })
    .join("\n");

  // Sales supervision flags
  const salesFlags: string[] = [];
  for (const [name, s] of Object.entries(rcCallsByEmployee)) {
    const avgCallSec = (s.outbound + s.inbound - s.missed) > 0 ? s.talkTimeSec / (s.outbound + s.inbound - s.missed) : 0;
    if (avgCallSec > 0 && avgCallSec < 120 && (s.outbound + s.inbound) >= 2) {
      salesFlags.push(`  ⚠️ ${name}: avg call under 2 min (${Math.round(avgCallSec)}s) — may be rushing through conversations`);
    }
    if (s.missed >= 3) {
      salesFlags.push(`  ⚠️ ${name}: ${s.missed} missed calls today — needs follow-up`);
    }
    const emailActivity = emailsByEmployee[name];
    if (s.outbound >= 3 && (!emailActivity || emailActivity.sent === 0)) {
      salesFlags.push(`  ⚠️ ${name}: ${s.outbound} outbound calls but 0 email follow-ups — may need to send written recaps`);
    }
  }

  // ═══ SYNC STALENESS DETECTION ═══
  // Check integration_connections FIRST for actual sync health, then fall back to call data
  const rcConnection = rcSyncStatus?.[0];
  const rcSyncLastAt = rcConnection?.last_sync_at ? new Date(rcConnection.last_sync_at) : null;
  const rcSyncConnected = rcConnection?.status === "connected";
  const rcSyncHoursSinceSync = rcSyncLastAt ? (Date.now() - rcSyncLastAt.getTime()) / 3600000 : null;

  const lastRcCallDate = rcLastCallEver?.[0]?.received_at
    ? new Date(rcLastCallEver[0].received_at)
    : null;
  let syncStalenessLine = "";

  if (rcConnection && rcSyncConnected && rcSyncHoursSinceSync !== null && rcSyncHoursSinceSync < 2) {
    // Sync connection is healthy and recently synced — no warning regardless of call volume
    if (totalRcCalls === 0) {
      syncStalenessLine = "  ✅ SYNC STATUS: RingCentral sync is running normally. No calls recorded today — just a quiet day.";
    }
    // If there ARE calls today, no status line needed at all
  } else if (rcConnection && (rcConnection.status === "error" || (rcSyncHoursSinceSync !== null && rcSyncHoursSinceSync > 12))) {
    // Sync connection exists but is errored or stale
    syncStalenessLine = `  ⚠️ SYNC STATUS: RingCentral connection is ${rcConnection.status}. Last sync was ${rcSyncHoursSinceSync ? Math.round(rcSyncHoursSinceSync) + " hours ago" : "unknown"}. Check the RingCentral connection.`;
  } else if (!rcConnection) {
    // No integration_connections row — fall back to call-based detection
    if (!lastRcCallDate) {
      syncStalenessLine = "  ⚠️ SYNC STATUS: No RingCentral calls found in the system. Phone sync may not be configured yet.";
    } else {
      const hoursSinceLastCall = (Date.now() - lastRcCallDate.getTime()) / 3600000;
      const daysSinceLastCall = hoursSinceLastCall / 24;
      if (daysSinceLastCall > 3) {
        syncStalenessLine = `  ⚠️ SYNC STATUS: Last RC call was ${Math.round(daysSinceLastCall)} days ago. Phone sync may be down — check the RingCentral connection.`;
      } else if (totalRcCalls === 0 && hoursSinceLastCall > 24) {
        syncStalenessLine = "  ✅ SYNC STATUS: RingCentral sync appears healthy. No calls recorded today.";
      }
    }
  }

  // Build structured facts block for anti-hallucination anchoring
  const factsBlock = `[FACTS] staff=${totalStaff}, customers=${totalCustomerCount}, open_leads=${openLeads}, AR=${fmt(totalReceivable)}, AP=${fmt(totalPayable)}, scheduled_deliveries=${scheduledToday}, in_transit=${inTransit}, rc_calls_today=${totalRcCalls}, rc_missed=${totalRcMissed} [/FACTS]`;

  // Build output as parts array to avoid deeply-nested template literal parsing issues
  const parts: string[] = [];

  parts.push(factsBlock);
  parts.push("");
  parts.push(`═══ LIVE BUSINESS SNAPSHOT (${new Date().toLocaleString()}) ═══`);
  parts.push("");

  if (includeFinancials) {
    const overdueInvTotal = overdueInvoices.reduce((s: number, i: any) => s + i.Balance, 0);
    const overdueBillTotal = overdueBills.reduce((s: number, b: any) => s + b.Balance, 0);
    parts.push("📊 FINANCIALS");
    parts.push(`  Accounts Receivable: ${fmt(totalReceivable)}`);
    parts.push(`  Accounts Payable: ${fmt(totalPayable)}`);
    parts.push(`  Overdue Invoices: ${overdueInvoices.length} totaling ${fmt(overdueInvTotal)}`);
    parts.push(topOverdueCustomers || "    None");
    parts.push(`  Overdue Bills: ${overdueBills.length} totaling ${fmt(overdueBillTotal)}`);
    parts.push(topOverdueVendors || "    None");
  } else {
    parts.push("📊 FINANCIALS");
    parts.push("  Restricted — requires admin access");
  }

  parts.push("");
  parts.push("🏭 PRODUCTION");
  parts.push(`  Active Cut Plans: ${activeCutPlans}`);
  parts.push(`  Items in Queue: ${queuedItems}`);
  parts.push(`  Completed Today: ${completedToday}`);
  parts.push(`  Machines Running: ${machinesRunning}`);
  parts.push(`  Active Work Orders: ${activeOrders ?? 0}`);

  parts.push("");
  parts.push("📈 SALES PIPELINE");
  parts.push(`  Open Leads: ${openLeads}`);
  parts.push("  Hot Leads (score ≥70):");
  parts.push(hotLeads || "    None");

  parts.push("");
  parts.push(`👥 CUSTOMER DIRECTORY (Top ${(customerDirectory || []).length} by Revenue)`);
  parts.push(
    (customerDirectory || []).map((c: any) =>
      "  • " + (c.display_name || "Unknown") + ": Revenue " + fmt(c.total_revenue || 0) + ", Open Balance " + fmt(c.open_balance || 0) + ", Balance " + fmt(c.balance || 0)
    ).join("\n") || "  No customer data"
  );

  parts.push("");
  parts.push(`💳 TRANSACTION SUMMARY (Recent ${(recentInvoiceDetails || []).length} Invoices)`);
  parts.push(
    (recentInvoiceDetails || []).map((inv: any) => {
      const custName = inv.data?.CustomerRef?.name || "Unknown";
      const invNum = inv.data?.DocNumber || "N/A";
      const dueDate = inv.data?.DueDate || "N/A";
      const total = inv.data?.TotalAmt || inv.balance || 0;
      const status = inv.balance > 0 ? "Open" : "Paid";
      return "  • INV#" + invNum + " — " + custName + ": " + fmt(total) + " (Due: " + dueDate + ", " + status + ", Bal: " + fmt(inv.balance || 0) + ")";
    }).join("\n") || "  No invoice data"
  );

  parts.push("");
  parts.push("👥 CUSTOMERS TOTAL");
  parts.push(`  Total Active: ${totalCustomers ?? 0}`);

  parts.push("");
  parts.push("🚚 DELIVERIES TODAY");
  parts.push(`  Scheduled: ${scheduledToday}`);
  parts.push(`  In Transit: ${inTransit}`);

  parts.push("");
  parts.push(`👷 TEAM (${totalStaff} staff)`);

  parts.push("");
  parts.push("⏱️ TEAM PRESENCE & HOURS TODAY");
  parts.push(presenceLines.length > 0 ? presenceLines.join("\n") : "  No time clock entries today");
  if (hoursLines) {
    parts.push("\n  Hours Worked Today:\n" + hoursLines);
  }

  parts.push("");
  parts.push("📊 EMPLOYEE PERFORMANCE (TODAY — REAL DATA)");
  parts.push("  Work Order Activity:");
  parts.push(woPerformanceLines || "    No work orders with assignees today");
  parts.push("  Machine Operators Active:");
  parts.push(operatorLines || "    No operators currently assigned");
  parts.push("  AI Agent Usage by Employee:");
  parts.push(agentUsageLines || "    No agent sessions today");
  parts.push("  Agent Actions by Employee:");
  parts.push(actionsLines || "    No agent actions today");
  parts.push("  All Logged Actions by Employee:");
  parts.push(employeeEventLines || "    No activity events today");

  parts.push("");
  parts.push("📧 EMAIL BIRD'S-EYE VIEW (TODAY)");
  parts.push(`  Total Inbound: ${totalInbound} | Total Outbound: ${totalOutbound}`);
  parts.push(`  Unanswered Threads: ${unansweredCount}`);
  parts.push("  Per-Employee Email Activity:");
  parts.push(emailByEmployeeLines || "    No email activity today");

  parts.push("");
  parts.push(`📞 RINGCENTRAL CALLS TODAY (${totalRcCalls} total)`);
  if (syncStalenessLine) parts.push(syncStalenessLine);
  parts.push(`  Inbound: ${totalRcInbound} | Outbound: ${totalRcCalls - totalRcInbound} | Missed: ${totalRcMissed}`);
  parts.push("  Per-Employee Call Activity:");
  parts.push(rcEmployeeLines || "    No call activity today");
  parts.push("  Call Details:");
  parts.push(rcCallDetails.length > 0 ? rcCallDetails.join("\n") : "    No calls today");
  if (salesFlags.length > 0) {
    parts.push("\n  🚨 SALES & CALL SUPERVISION FLAGS:\n" + salesFlags.join("\n"));
  }

  parts.push("");
  parts.push(`📝 CALL NOTES & TRANSCRIPTS (from RingCentral AI Assistant — ${(rcCallNoteEmails || []).length} in last 7 days)`);
  if ((rcCallNoteEmails || []).length > 0) {
    parts.push(
      (rcCallNoteEmails || []).map((note: any) => {
        const time = note.received_at ? new Date(note.received_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "?";
        const recipient = note.to_address || "unknown";
        const recipientName = emailProfileMap.get(recipient?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || "") || recipient;
        const preview = note.body_preview ? note.body_preview.replace(/\n/g, " ").slice(0, 500) : "(no preview)";
        return "  • [" + time + "] " + (note.subject || "Call Note") + " → " + recipientName + "\n      " + preview;
      }).join("\n")
    );
  } else {
    parts.push("  No call notes in the last 7 days");
  }

  parts.push("");
  parts.push("👣 DIGITAL FOOTPRINT — REAL ACTIVE TIME (TODAY)");
  parts.push("  Based on: page views, emails sent, calls, AI sessions, work orders, agent actions");
  parts.push("  Idle gap threshold: 15 minutes (gaps longer than 15min = not counted as active)");
  parts.push(footprintLines.length > 0 ? footprintLines.join("\n") : "  No footprint data today");
  if (footprintAlerts.length > 0) {
    parts.push("\n  🚨 UTILIZATION ALERTS:\n" + footprintAlerts.join("\n"));
  }

  parts.push("");
  parts.push("📋 DAILY REPORT PER PERSON");
  parts.push(buildPerPersonReports(profiles || [], hoursWorked, emailsByEmployee, rcCallsByEmployee, woByAssignee, agentUsageByUser, actionsByUser, eventsByEmployee, footprintTimestamps, machineOps || [], profileIdMap));

  parts.push("");
  parts.push("📋 RECENT ACTIVITY");
  parts.push(eventsList || "  No recent events");

  parts.push("");
  parts.push(`📧 EMAIL INBOX (last ${(communications || []).length} emails)`);
  parts.push(emailsList || "  No emails available");

  parts.push("");
  parts.push("💡 PENDING SUGGESTIONS");
  parts.push(suggestionsList || "  None");

  parts.push("");
  parts.push(`📦 STOCK SUMMARY`);
  parts.push(
    (stockSummary || []).map((s: any) => "  • " + s.bar_code + ": " + s.qty_on_hand + " @ " + (s.location || "unknown")).join("\n") || "  No stock data"
  );

  parts.push("");
  parts.push(`🧠 KNOWLEDGE BASE (${totalKnowledge} entries, showing latest 50)`);
  parts.push(brainList || "  No entries");

  parts.push("");
  parts.push(`🧠 PERSISTENT MEMORY (${activeMemories.length} items)`);
  parts.push(memorySection);

  // Voicemail inbox
  parts.push("");
  parts.push("📞 VOICEMAIL INBOX (unprocessed)");
  const voicemails = activeMemories.filter((m: any) => m.category === "voicemail_summary" && !(m.metadata as any)?.processed);
  if (voicemails.length === 0) {
    parts.push("  No new voicemails");
  } else {
    parts.push(voicemails.map((vm: any) => {
      const meta = (vm.metadata || {}) as any;
      const time = vm.created_at ? new Date(vm.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "?";
      const caller = meta.contact_name || meta.from_number || "Unknown";
      const taskStr = (meta.tasks || []).length > 0
        ? " | Actions: " + (meta.tasks || []).map((t: any) => t.title).join(", ")
        : "";
      return "  • [" + time + "] From " + caller + ": " + (vm.content || "").slice(0, 200) + taskStr;
    }).join("\n"));
  }

  // Call summaries
  parts.push("");
  parts.push("📞 RECENT CALL SUMMARIES (auto-answered by Vizzy)");
  const callSummaries = activeMemories.filter((m: any) => m.category === "call_summary");
  if (callSummaries.length === 0) {
    parts.push("  No auto-answered calls");
  } else {
    parts.push(callSummaries.slice(0, 10).map((cs: any) => {
      const meta = (cs.metadata || {}) as any;
      const time = cs.created_at ? new Date(cs.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "?";
      const caller = meta.contact_name || meta.from_number || "Unknown";
      const taskStr = (meta.tasks || []).length > 0
        ? " | Actions: " + (meta.tasks || []).map((t: any) => t.title).join(", ")
        : "";
      return "  • [" + time + "] " + caller + ": " + (cs.content || "").slice(0, 200) + taskStr;
    }).join("\n"));
  }

  // Open tasks
  parts.push("");
  parts.push(`═══ OPEN TASKS (${(openHumanTasks || []).length} active — DO NOT create duplicates) ═══`);
  if ((openHumanTasks || []).length > 0) {
    parts.push((openHumanTasks || []).map((t: any) => {
      const assignee = t.assigned_to ? (profileIdMap.get(t.assigned_to) || "Unassigned") : "Unassigned";
      const created = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return "  • [" + (t.priority || "medium") + '] "' + t.title + '" → ' + assignee + " (" + t.status + ", created " + created + ")" + (t.category ? " [" + t.category + "]" : "");
    }).join("\n"));
  } else {
    parts.push("  No open tasks");
  }

  return parts.join("\n");
}

/** Build a unified mini daily report per employee combining ALL data sources */
function buildPerPersonReports(
  profiles: any[],
  hoursWorked: Record<string, number>,
  emailsByEmployee: Record<string, { sent: number; received: number }>,
  rcCallsByEmployee: Record<string, { outbound: number; inbound: number; missed: number; talkTimeSec: number }>,
  woByAssignee: Record<string, { total: number; completed: number; inProgress: number }>,
  agentUsageByUser: Record<string, { sessions: number; agents: Set<string>; lastTopic: string }>,
  actionsByUser: Record<string, { count: number; types: Set<string> }>,
  eventsByEmployee: Record<string, { count: number; types: Set<string> }>,
  footprintTimestamps: Record<string, number[]>,
  machineOps: any[],
  profileIdMap: Map<string, string>,
): string {
  // Collect all unique employee names that appear in ANY data source
  const allNames = new Set<string>();
  for (const p of profiles) if (p.full_name) allNames.add(p.full_name);
  Object.keys(hoursWorked).forEach(n => allNames.add(n));
  Object.keys(emailsByEmployee).forEach(n => allNames.add(n));
  Object.keys(rcCallsByEmployee).forEach(n => allNames.add(n));
  Object.keys(woByAssignee).forEach(n => allNames.add(n));
  Object.keys(agentUsageByUser).forEach(n => allNames.add(n));
  Object.keys(actionsByUser).forEach(n => allNames.add(n));
  Object.keys(eventsByEmployee).forEach(n => allNames.add(n));
  Object.keys(footprintTimestamps).forEach(n => allNames.add(n));
  allNames.delete("Unknown");

  if (allNames.size === 0) return "  No employee data today";

  const IDLE_GAP_MS = 15 * 60 * 1000;
  const reports: string[] = [];

  for (const name of Array.from(allNames).sort()) {
    const parts: string[] = [];

    // Hours
    const hrs = hoursWorked[name];
    if (hrs !== undefined) parts.push(`⏱ ${hrs.toFixed(1)}hrs clocked`);

    // Footprint / active time
    const fp = footprintTimestamps[name];
    if (fp && fp.length >= 2) {
      const sorted = [...fp].sort((a, b) => a - b);
      let activeMs = 0;
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        if (gap <= IDLE_GAP_MS) activeMs += gap;
      }
      const activeHrs = (activeMs / 3600000).toFixed(1);
      const utilPct = hrs ? Math.round((activeMs / 3600000 / hrs) * 100) : 0;
      parts.push(`👣 ${activeHrs}hrs active (${utilPct}% utilization, ${fp.length} actions)`);
    } else if (fp && fp.length === 1) {
      parts.push(`👣 1 action recorded`);
    }

    // Emails — with subject details and action items
    const em = emailsByEmployee[name];
    if (em) {
      parts.push(`📧 ${em.sent} sent, ${em.received} received`);
      // Show key emails for this employee (up to 8)
      const keyEmails = em.emails.slice(0, 8);
      for (const e of keyEmails) {
        parts.push(`    [${e.direction.toUpperCase()} ${e.time}] "${e.subject}" ${e.direction === "inbound" ? "from " + e.from : "to " + e.to}`);
        if (e.preview) parts.push(`      ${e.preview.slice(0, 150)}`);
      }
      // Flag unanswered inbound emails as pending tasks
      const inboundEmails = em.emails.filter(e => e.direction === "inbound");
      const outboundSubjects = new Set(em.emails.filter(e => e.direction === "outbound").map(e => e.subject.toLowerCase()));
      const unanswered = inboundEmails.filter(e => !outboundSubjects.has("re: " + e.subject.toLowerCase()));
      if (unanswered.length > 0) {
        parts.push(`    ⚠️ ${unanswered.length} inbound email(s) may need a reply:`);
        for (const u of unanswered.slice(0, 5)) {
          parts.push(`      → "${u.subject}" from ${u.from} (${u.time})`);
        }
      }
    }

    // Calls
    const calls = rcCallsByEmployee[name];
    if (calls) {
      const talkMin = Math.round(calls.talkTimeSec / 60);
      parts.push(`📞 ${calls.outbound} out, ${calls.inbound} in, ${calls.missed} missed (${talkMin}min talk)`);
    }

    // Work orders
    const wo = woByAssignee[name];
    if (wo) parts.push(`🔧 ${wo.total} WOs (${wo.completed} done, ${wo.inProgress} active)`);

    // Agent sessions
    const agent = agentUsageByUser[name];
    if (agent) parts.push(`🤖 ${agent.sessions} AI sessions (${Array.from(agent.agents).join(", ")})`);

    // Agent actions
    const actions = actionsByUser[name];
    if (actions) parts.push(`⚡ ${actions.count} agent actions`);

    // Activity events
    const events = eventsByEmployee[name];
    if (events) parts.push(`📊 ${events.count} logged events`);

    // Machine operator
    const operating = machineOps.filter((m: any) => profileIdMap.get(m.current_operator_profile_id) === name);
    if (operating.length > 0) parts.push(`🏭 Operating: ${operating.map((m: any) => m.name).join(", ")}`);

    // Build report
    if (parts.length === 0) {
      reports.push(`  👤 ${name}: No recorded activity today`);
    } else {
      reports.push(`  👤 ${name}:\n${parts.map(p => `      ${p}`).join("\n")}`);
    }
  }

  return reports.join("\n");
}
