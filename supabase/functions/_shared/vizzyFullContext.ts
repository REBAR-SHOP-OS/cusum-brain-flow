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
    { data: agentSessions },
    { data: timeClockEntries },
    { data: memories },
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

⏱️ TEAM PRESENCE
${presenceLines.length > 0 ? presenceLines.join("\n") : "  No time clock entries today"}

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
