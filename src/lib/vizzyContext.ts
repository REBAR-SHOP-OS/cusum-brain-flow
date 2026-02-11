import type { VizzyBusinessSnapshot } from "@/hooks/useVizzyContext";

export function buildVizzyContext(snap: VizzyBusinessSnapshot): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const { financials: f, production: p, crm, customers: c, deliveries: d, team, recentEvents } = snap;

  const bankAccounts = f.accounts
    .filter((a) => a.AccountType === "Bank" && a.Active)
    .map((a) => `  • ${a.Name}: ${fmt(a.CurrentBalance)}`)
    .join("\n");

  const overdueInvTotal = f.overdueInvoices.reduce((s, i) => s + (i.Balance || 0), 0);
  const overdueBillTotal = f.overdueBills.reduce((s, b) => s + (b.Balance || 0), 0);

  const topOverdueCustomers = f.overdueInvoices
    .slice(0, 5)
    .map((inv) => `  • ${inv.CustomerRef?.name}: ${fmt(inv.Balance)} (due ${inv.DueDate})`)
    .join("\n");

  const topOverdueVendors = f.overdueBills
    .slice(0, 5)
    .map((b) => `  • ${b.VendorRef?.name}: ${fmt(b.Balance)} (due ${b.DueDate})`)
    .join("\n");

  const recentPayments = f.payments
    .slice(0, 5)
    .map((p) => `  • ${p.CustomerRef?.name}: ${fmt(p.TotalAmt)} on ${p.TxnDate}`)
    .join("\n");

  const hotLeadsList = crm.hotLeads
    .map((l) => `  • ${l.contact_name} (${l.company_name}) — Score: ${l.lead_score}, Expected: ${fmt(l.expected_revenue || 0)}`)
    .join("\n");

  const eventsList = recentEvents
    .slice(0, 10)
    .map((e) => `  • [${e.event_type}] ${e.entity_type}: ${e.description || "No description"}`)
    .join("\n");

  return `YOU ARE VIZZY — the CEO's personal AI assistant (like Jarvis for Iron Man).
You have FULL access to live business data. Use ONLY these numbers. NEVER make up figures.
Log every question the CEO asks mentally — you are building their daily journey.
Be proactive: flag risks, suggest actions, connect dots across departments.
Speak like a trusted advisor — concise, direct, confident.

═══ LIVE BUSINESS SNAPSHOT (${new Date().toLocaleString()}) ═══

📊 FINANCIALS
  Accounts Receivable: ${fmt(f.totalReceivable)}
  Accounts Payable: ${fmt(f.totalPayable)}
  Overdue Invoices: ${f.overdueInvoices.length} totaling ${fmt(overdueInvTotal)}
${topOverdueCustomers || "    None"}
  Overdue Bills: ${f.overdueBills.length} totaling ${fmt(overdueBillTotal)}
${topOverdueVendors || "    None"}

🏦 BANK ACCOUNTS
${bankAccounts || "  No bank data available"}

💰 RECENT PAYMENTS
${recentPayments || "  None"}

🏭 PRODUCTION
  Active Cut Plans: ${p.activeCutPlans}
  Items in Queue: ${p.queuedItems}
  Completed Today: ${p.completedToday}
  Machines Running: ${p.machinesRunning}

📈 SALES PIPELINE
  Open Leads: ${crm.openLeads}
  Hot Leads (score ≥70):
${hotLeadsList || "    None"}

👥 CUSTOMERS
  Active Customers: ${c.totalActive}

🚚 DELIVERIES TODAY
  Scheduled: ${d.scheduledToday}
  In Transit: ${d.inTransit}

👷 TEAM
  Staff Total: ${team.totalStaff}

📋 RECENT ACTIVITY
${eventsList || "  No recent events"}

═══ INSTRUCTIONS ═══
• If asked about data you don't have, say "I don't have that information right now" — never guess.
• Track topics discussed. At session end, you'll help write a daily journey.
• Cross-reference data: if AR is high and production is slow, flag it.
• Be the CEO's memory — remind about overdue items, hot leads, and team status.`;
}
