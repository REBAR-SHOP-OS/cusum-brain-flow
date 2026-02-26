/**
 * Executive Dashboard Context — aggregates cross-agent KPIs for the Data/Prism agent.
 * Used for executive-level summaries and weekly digest generation.
 */

export async function fetchExecutiveContext(
  supabase: any,
  companyId: string
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [
    { data: arData },
    { data: apData },
    { data: pipelineLeads },
    { count: openTickets },
    { data: productionItems },
    { data: deliveries },
    { data: recentOrders },
    { count: totalCustomers },
    { data: weeklyEvents },
    { data: agentActivity },
  ] = await Promise.all([
    // AR: open invoices
    supabase
      .from("accounting_mirror")
      .select("balance, data")
      .eq("entity_type", "Invoice")
      .eq("company_id", companyId)
      .gt("balance", 0)
      .limit(200),
    // AP: open bills
    supabase
      .from("accounting_mirror")
      .select("balance, data")
      .eq("entity_type", "Vendor")
      .eq("company_id", companyId)
      .gt("balance", 0)
      .limit(200),
    // Pipeline: active leads
    supabase
      .from("leads")
      .select("id, expected_value, status, stage, lead_score")
      .eq("company_id", companyId)
      .in("status", ["new", "contacted", "qualified", "proposal"])
      .order("lead_score", { ascending: false })
      .limit(50),
    // Support: open tickets
    supabase
      .from("support_conversations")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["open", "assigned", "pending"]),
    // Production: active cut plan items
    supabase
      .from("cut_plan_items")
      .select("id, phase, completed_pieces, total_pieces, bar_code")
      .in("phase", ["queued", "cutting", "bending", "cut_done"])
      .limit(500),
    // Delivery: this week
    supabase
      .from("deliveries")
      .select("id, status, scheduled_date")
      .eq("company_id", companyId)
      .gte("scheduled_date", weekAgo)
      .limit(100),
    // Orders: recent week
    supabase
      .from("orders")
      .select("id, total_amount, status, order_date")
      .eq("company_id", companyId)
      .gte("order_date", weekAgo)
      .limit(50),
    // Customer count
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId),
    // Activity events this week
    supabase
      .from("activity_events")
      .select("event_type, entity_type, description, created_at")
      .eq("company_id", companyId)
      .gte("created_at", weekAgo + "T00:00:00")
      .order("created_at", { ascending: false })
      .limit(30),
    // Agent usage this week
    supabase
      .from("chat_sessions")
      .select("agent_name, user_id, created_at")
      .gte("created_at", weekAgo + "T00:00:00")
      .limit(200),
  ]);

  // Compute KPIs
  const totalAR = (arData || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);
  const overdueAR = (arData || []).filter((r: any) => r.data?.DueDate && r.data.DueDate < today);
  const totalOverdueAR = overdueAR.reduce((s: number, r: any) => s + (r.balance || 0), 0);

  const totalAP = (apData || []).reduce((s: number, r: any) => s + (r.balance || 0), 0);

  const pipelineValue = (pipelineLeads || []).reduce((s: number, l: any) => s + (l.expected_value || 0), 0);
  const hotLeads = (pipelineLeads || []).filter((l: any) => (l.lead_score || 0) >= 70).length;

  const totalPieces = (productionItems || []).reduce((s: number, i: any) => s + (i.total_pieces || 0), 0);
  const completedPieces = (productionItems || []).reduce((s: number, i: any) => s + (i.completed_pieces || 0), 0);
  const productionProgress = totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0;

  const deliveriesCompleted = (deliveries || []).filter((d: any) => d.status === "delivered").length;
  const deliveriesTotal = (deliveries || []).length;
  const deliverySuccessRate = deliveriesTotal > 0 ? Math.round((deliveriesCompleted / deliveriesTotal) * 100) : 0;

  const weeklyRevenue = (recentOrders || [])
    .filter((o: any) => o.status !== "cancelled")
    .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

  // Agent usage summary
  const agentUsage: Record<string, number> = {};
  for (const session of (agentActivity || [])) {
    agentUsage[session.agent_name] = (agentUsage[session.agent_name] || 0) + 1;
  }

  return {
    executiveKPIs: {
      financial: {
        totalAR: Math.round(totalAR * 100) / 100,
        totalOverdueAR: Math.round(totalOverdueAR * 100) / 100,
        overdueInvoiceCount: overdueAR.length,
        totalAP: Math.round(totalAP * 100) / 100,
        weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
      },
      pipeline: {
        activeLeads: (pipelineLeads || []).length,
        hotLeads,
        pipelineValue: Math.round(pipelineValue * 100) / 100,
      },
      production: {
        activeItems: (productionItems || []).length,
        completedPieces,
        totalPieces,
        progressPercent: productionProgress,
      },
      delivery: {
        weeklyTotal: deliveriesTotal,
        completed: deliveriesCompleted,
        successRatePercent: deliverySuccessRate,
      },
      support: {
        openTickets: openTickets || 0,
      },
      customers: {
        total: totalCustomers || 0,
      },
      agentUsage,
      recentEvents: (weeklyEvents || []).slice(0, 10),
    },
  };
}
