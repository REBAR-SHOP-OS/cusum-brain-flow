import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface CEOAlert {
  type: "error" | "warning";
  message: string;
}

export interface CEOException {
  id: string;
  category: "cash" | "ops" | "sales" | "delivery";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  owner: string;
  age: string;
}

export interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface AtRiskJob {
  id: string;
  name: string;
  customer: string;
  dueDate: string;
  daysLeft: number;
  riskReason: string;
  probability: number;
}

export interface CapacityForecastDay {
  day: string;
  capacity: number;
  load: number;
  utilization: number;
}

export interface CEOMetrics {
  // Production
  activeProjects: number;
  activeOrders: number;
  totalPieces: number;
  completedPieces: number;
  productionProgress: number;
  machinesRunning: number;
  totalMachines: number;
  activeCutPlans: number;
  runHoursToday: number;
  activeRuns: number;
  tonnageToday: number;
  scrapRate: number;

  // Phase counters
  queuedItems: number;
  inProgressItems: number;
  completedToday: number;

  // Financial
  outstandingAR: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  pipelineValue: number;
  openLeads: number;
  activeCustomers: number;

  // Team
  totalTeam: number;
  teamActiveToday: number;
  teamOnClockPercent: number;
  clockInsToday: number;

  // Deliveries & Pickups
  pendingDeliveries: number;
  pickupsReady: number;

  // Inventory
  inventoryLotsActive: number;
  totalStockBars: number;

  // Communications
  commsToday: number;

  // Social
  publishedPosts: number;
  scheduledPosts: number;

  // Health
  healthScore: number;

  // Alerts
  alerts: CEOAlert[];

  // Exceptions (real data)
  exceptions: CEOException[];

  // Pipeline stages
  pipelineByStage: Record<string, { count: number; value: number }>;

  // Recent orders
  recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    customer_name: string;
    order_date: string;
  }>;

  // Machine status
  machineStatuses: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;

  // Production trend (last 7 days)
  dailyProduction: Array<{
    date: string;
    runs: number;
    pieces: number;
  }>;

  // Live AR aging buckets
  arAgingBuckets: ARAgingBucket[];

  // Live at-risk jobs
  atRiskJobs: AtRiskJob[];

  // Live capacity forecast
  capacityForecast: CapacityForecastDay[];

  // QC & SLA metrics
  blockedJobs: number;
  qcBacklog: number;
  revenueHeld: number;
  slaBreach: { total: number; leads: number; orders: number };
}

function calculateHealthScore(params: {
  productionProgress: number;
  machinesRunning: number;
  totalMachines: number;
  outstandingAR: number;
  pipelineValue: number;
  teamOnClockPercent: number;
}): number {
  const prodScore = Math.min(params.productionProgress, 100);
  const machineUptime = params.totalMachines > 0 ? (params.machinesRunning / params.totalMachines) * 100 : 50;
  const arRatio = params.pipelineValue > 0 ? Math.max(0, 100 - (params.outstandingAR / params.pipelineValue) * 100) : 50;
  const teamScore = params.teamOnClockPercent;

  const score = Math.round(prodScore * 0.3 + machineUptime * 0.25 + arRatio * 0.25 + teamScore * 0.2);
  return Math.max(0, Math.min(100, score));
}

async function fetchCEOMetrics(companyId: string): Promise<CEOMetrics> {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    projectsRes, ordersRes, cutItemsRes, machinesRes,
    deliveriesRes, leadsRes, customersRes, profilesRes,
    clockRes, inventoryRes, commsRes, socialRes,
    accountingRes, runsRes, cutPlansRes, pickupsRes,
    recentOrdersRes, pipelineRes, dailyRunsRes,
    phaseItemsRes,
  ] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["active", "pending"]),
    supabase.from("cut_plan_items").select("total_pieces, completed_pieces, cut_plans!inner(company_id)").eq("cut_plans.company_id", companyId!),
    supabase.from("machines").select("id, name, type, status"),
    supabase.from("deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "in-transit", "loading"]),
    supabase.from("leads").select("stage, expected_value").not("stage", "in", "(closed_won,closed_lost)"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("time_clock_entries").select("profile_id").gte("clock_in", todayStart),
    supabase.from("inventory_lots").select("qty_on_hand").gt("qty_on_hand", 0),
    supabase.from("communications").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("social_posts").select("status"),
    supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Invoice"),
    supabase.from("machine_runs").select("id, status, started_at, ended_at").gte("started_at", todayStart),
    supabase.from("cut_plans").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]),
    supabase.from("pickup_orders").select("id", { count: "exact", head: true }).eq("status", "ready"),
    supabase.from("orders").select("id, order_number, status, total_amount, customer_id, order_date, customers(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("stage, expected_value"),
    supabase.from("machine_runs").select("started_at, status").gte("started_at", weekAgo),
    supabase.from("cut_plan_items").select("phase, cut_plans!inner(company_id)").eq("cut_plans.company_id", companyId),
  ]);

  // Production metrics
  const cutItems = cutItemsRes.data || [];
  const totalPieces = cutItems.reduce((s, i) => s + (i.total_pieces || 0), 0);
  const completedPieces = cutItems.reduce((s, i) => s + (i.completed_pieces || 0), 0);
  const productionProgress = totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0;

  // Machine metrics
  const machines = machinesRes.data || [];
  const machinesRunning = machines.filter((m) => m.status === "running").length;

  // Run hours
  const runs = runsRes.data || [];
  const runHoursToday = runs.reduce((sum, r) => {
    const start = new Date(r.started_at).getTime();
    const end = r.ended_at ? new Date(r.ended_at).getTime() : Date.now();
    return sum + (end - start) / 3600000;
  }, 0);

  // Clock entries
  const clockEntries = clockRes.data || [];
  const uniqueWorkers = new Set(clockEntries.map((c) => c.profile_id));
  const totalTeam = profilesRes.count || 0;
  const teamActiveToday = uniqueWorkers.size;
  const teamOnClockPercent = totalTeam > 0 ? Math.round((teamActiveToday / totalTeam) * 100) : 0;

  // Inventory
  const inventory = inventoryRes.data || [];
  const totalStockBars = inventory.reduce((s, i) => s + (i.qty_on_hand || 0), 0);

  // Social
  const socialPosts = socialRes.data || [];
  const publishedPosts = socialPosts.filter((p) => p.status === "published").length;
  const scheduledPosts = socialPosts.filter((p) => p.status === "scheduled").length;

  // Accounting - split unpaid vs overdue + aging buckets
  const allInvoices = accountingRes.data || [];
  const unpaidInvoices = allInvoices.filter((i) => (i.balance || 0) > 0);
  const outstandingAR = unpaidInvoices.reduce((s, i) => s + (i.balance || 0), 0);

  // Compute AR aging buckets from invoice data
  const now = Date.now();
  const arAgingBuckets: ARAgingBucket[] = [
    { bucket: "Current", amount: 0, count: 0 },
    { bucket: "1-30", amount: 0, count: 0 },
    { bucket: "31-60", amount: 0, count: 0 },
    { bucket: "61-90", amount: 0, count: 0 },
    { bucket: "90+", amount: 0, count: 0 },
  ];
  for (const inv of unpaidInvoices) {
    const data = inv.data as Record<string, unknown> | null;
    const dueDate = data?.DueDate as string | undefined;
    const bal = inv.balance || 0;
    if (!dueDate) { arAgingBuckets[0].amount += bal; arAgingBuckets[0].count++; continue; }
    const daysOverdue = Math.floor((now - new Date(dueDate).getTime()) / 86400000);
    if (daysOverdue <= 0) { arAgingBuckets[0].amount += bal; arAgingBuckets[0].count++; }
    else if (daysOverdue <= 30) { arAgingBuckets[1].amount += bal; arAgingBuckets[1].count++; }
    else if (daysOverdue <= 60) { arAgingBuckets[2].amount += bal; arAgingBuckets[2].count++; }
    else if (daysOverdue <= 90) { arAgingBuckets[3].amount += bal; arAgingBuckets[3].count++; }
    else { arAgingBuckets[4].amount += bal; arAgingBuckets[4].count++; }
  }
  const overdueInvoices = arAgingBuckets.slice(1).reduce((s, b) => s + b.count, 0);

  // Leads pipeline
  const allLeads = pipelineRes.data || [];
  const openLeads = leadsRes.data || [];
  const pipelineValue = openLeads.reduce((s, l) => s + (l.expected_value || 0), 0);

  const pipelineByStage: Record<string, { count: number; value: number }> = {};
  for (const lead of allLeads) {
    const stage = lead.stage || "unknown";
    if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, value: 0 };
    pipelineByStage[stage].count++;
    pipelineByStage[stage].value += lead.expected_value || 0;
  }

  // Recent orders
  const recentOrders = (recentOrdersRes.data || []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total_amount: o.total_amount || 0,
    customer_name: o.customers?.name || "Unknown",
    order_date: o.order_date,
  }));

  // Daily production trend
  const dailyMap: Record<string, { runs: number; pieces: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { runs: 0, pieces: 0 };
  }
  for (const run of dailyRunsRes.data || []) {
    const key = new Date(run.started_at).toISOString().slice(0, 10);
    if (dailyMap[key]) dailyMap[key].runs++;
  }
  const dailyProduction = Object.entries(dailyMap).map(([date, data]) => ({ date, ...data }));

  // Tonnage & scrap (derived estimates from completed pieces)
  const tonnageToday = Math.round(completedPieces * 0.012 * 10) / 10; // ~12kg avg per piece
  const scrapRate = totalPieces > 0 ? Math.round(((totalPieces - completedPieces) * 0.02 / Math.max(totalPieces, 1)) * 100 * 10) / 10 : 0;

  // Alerts
  const alerts: CEOAlert[] = [];
  const machinesDown = machines.filter((m) => m.status === "down");
  if (machinesDown.length > 0) {
    alerts.push({ type: "error", message: `${machinesDown.length} machine${machinesDown.length > 1 ? "s" : ""} DOWN: ${machinesDown.map((m) => m.name).join(", ")}` });
  }
  if (overdueInvoices > 5) {
    alerts.push({ type: "warning", message: `${overdueInvoices} unpaid invoices totaling ${formatCurrencySimple(outstandingAR)}` });
  }
   const pendingDeliveries = deliveriesRes.count || 0;
  if (pendingDeliveries > 3) {
    alerts.push({ type: "warning", message: `${pendingDeliveries} deliveries pending dispatch` });
  }

  // Phase counters
  const phaseItems = phaseItemsRes.data || [];
  const queuedItems = phaseItems.filter((i) => i.phase === "queued").length;
  const inProgressItems = phaseItems.filter((i: any) => i.phase === "cutting" || i.phase === "bending").length;
  const completedToday = phaseItems.filter((i: any) => i.phase === "complete").length; // approximate — all complete items (no updated_at on cut_plan_items)

  // Real exceptions with aging labels
  const exceptions: CEOException[] = [];
  // Overdue invoices with real aging
  for (const inv of unpaidInvoices.slice(0, 5)) {
    const data = inv.data as Record<string, unknown> | null;
    const docNumber = (data?.DocNumber as string) || "Unknown";
    const customerName = (data?.CustomerRef as any)?.name || (data?.CustomerRef as any)?.Name || "Unknown";
    const dueDate = data?.DueDate as string | undefined;
    let ageLabel = "open";
    if (dueDate) {
      const daysOver = Math.floor((now - new Date(dueDate).getTime()) / 86400000);
      ageLabel = daysOver > 0 ? `${daysOver}d overdue` : `due in ${Math.abs(daysOver)}d`;
    }
    exceptions.push({
      id: `inv-${docNumber}`,
      category: "cash",
      severity: (inv.balance || 0) > 10000 ? "critical" : "warning",
      title: `Invoice #${docNumber} — $${(inv.balance || 0).toLocaleString()} unpaid`,
      detail: `Customer: ${customerName}. Outstanding balance needs collection follow-up.`,
      owner: "Collections",
      age: ageLabel,
    });
  }
  // Idle machines
  const idleMachines = machines.filter((m) => m.status === "idle");
  if (idleMachines.length > 0) {
    for (const mac of idleMachines.slice(0, 3)) {
      exceptions.push({
        id: `idle-${mac.id}`,
        category: "ops",
        severity: "warning",
        title: `${mac.name} idle — no active run`,
        detail: `Machine is available but unproductive. Consider assigning a cut plan.`,
        owner: "Foreman",
        age: "now",
      });
    }
  }
  // Down machines
  if (machinesDown.length > 0) {
    for (const mac of machinesDown) {
      exceptions.push({
        id: `down-${mac.id}`,
        category: "ops",
        severity: "critical",
        title: `${mac.name} DOWN`,
        detail: `Machine is offline. Requires maintenance attention.`,
        owner: "Maintenance",
        age: "active",
      });
    }
  }
  // Queued backlog
  if (queuedItems > 5) {
    exceptions.push({
      id: `backlog-queued`,
      category: "ops",
      severity: "info",
      title: `${queuedItems} items queued — backlog building`,
      detail: `Production queue has ${queuedItems} items waiting. Review capacity allocation.`,
      owner: "Production",
      age: "today",
    });
  }
  // Pending deliveries
  if (pendingDeliveries > 0) {
    exceptions.push({
      id: `del-pending`,
      category: "delivery",
      severity: pendingDeliveries > 3 ? "warning" : "info",
      title: `${pendingDeliveries} deliveries pending dispatch`,
      detail: `Deliveries awaiting driver assignment or dispatch.`,
      owner: "Dispatch",
      age: "today",
    });
  }

  // At-risk jobs: cut plans with low completion and approaching deadlines
  const atRiskJobs: AtRiskJob[] = [];
  // Use cut_plan_items grouped by cut_plan to estimate risk
  // For now, derive from cut items + machines blocked/down
  const blockedMachineNames = machines.filter(m => m.status === "blocked" || m.status === "down").map(m => m.name);
  if (blockedMachineNames.length > 0 || queuedItems > 10) {
    // Generate risk entries from queued backlog pressure
    const riskItems = cutItems.filter(i => (i.completed_pieces || 0) < (i.total_pieces || 1));
    const highBacklog = riskItems.length;
    if (highBacklog > 0) {
      atRiskJobs.push({
        id: "risk-backlog",
        name: `${highBacklog} items incomplete`,
        customer: "Various",
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        daysLeft: 3,
        riskReason: blockedMachineNames.length > 0
          ? `Capacity conflict — ${blockedMachineNames.join(", ")} blocked/down`
          : `High backlog — ${queuedItems} queued items`,
        probability: Math.min(85, 40 + blockedMachineNames.length * 15 + Math.floor(queuedItems / 2)),
      });
    }
  }
  // Add machine-specific risks
  for (const mac of machines.filter(m => m.status === "down")) {
    atRiskJobs.push({
      id: `risk-${mac.id}`,
      name: `${mac.name} offline impact`,
      customer: "All affected jobs",
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      daysLeft: 2,
      riskReason: `${mac.name} is down — jobs queued on this machine are delayed`,
      probability: 75,
    });
  }

  // Capacity forecast: estimate 7-day load from queued items vs machine throughput
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const capacityForecast: CapacityForecastDay[] = [];
  const avgDailyThroughput = runs.length > 0 ? Math.max(1, runs.length) : 5; // runs per day baseline
  const queuedPerDay = Math.ceil(queuedItems / 5); // spread over 5 workdays
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const dayName = dayNames[d.getDay()];
    const isSunday = d.getDay() === 0;
    const isSaturday = d.getDay() === 6;
    const dayCapacity = isSunday ? 0 : isSaturday ? 50 : 100;
    const dayLoad = isSunday ? 0 : isSaturday ? Math.round(queuedPerDay * 30) : Math.round((queuedPerDay / avgDailyThroughput) * 100);
    const utilization = dayCapacity > 0 ? Math.round((dayLoad / dayCapacity) * 100) : 0;
    capacityForecast.push({ day: dayName, capacity: dayCapacity, load: dayLoad, utilization: Math.min(130, utilization) });
  }

  const machineStatuses = machines.map((m) => ({ id: m.id, name: m.name, type: m.type, status: m.status }));

  // QC & SLA metrics
  const [blockedOrdersRes, qcBacklogRes, revenueHeldRes, slaBreachLeadsRes, slaBreachOrdersRes] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("production_locked", true).in("status", ["confirmed", "in_production"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("qc_final_approved", false).in("status", ["in_production"]),
    supabase.from("orders").select("total_amount").eq("qc_evidence_uploaded", false).in("status", ["in_production"]),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("sla_breached", true).not("stage", "in", "(won,lost,archived_orphan)"),
    supabase.from("sla_escalation_log").select("id, entity_type", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  const blockedJobs = blockedOrdersRes.count || 0;
  const qcBacklog = qcBacklogRes.count || 0;
  const revenueHeld = (revenueHeldRes.data || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
  const slaBreachTotal = (slaBreachLeadsRes.count || 0) + (slaBreachOrdersRes.count || 0);

  const healthScore = calculateHealthScore({
    productionProgress,
    machinesRunning,
    totalMachines: machines.length,
    outstandingAR,
    pipelineValue,
    teamOnClockPercent,
  });

  return {
    activeProjects: projectsRes.count || 0,
    activeOrders: ordersRes.count || 0,
    totalPieces,
    completedPieces,
    productionProgress,
    machinesRunning,
    totalMachines: machines.length,
    activeCutPlans: cutPlansRes.count || 0,
    runHoursToday: Math.round(runHoursToday * 10) / 10,
    activeRuns: runs.filter((r) => r.status === "running").length,
    tonnageToday,
    scrapRate,
    queuedItems,
    inProgressItems,
    completedToday,
    outstandingAR,
    unpaidInvoices: unpaidInvoices.length,
    overdueInvoices,
    pipelineValue,
    openLeads: openLeads.length,
    activeCustomers: customersRes.count || 0,
    totalTeam,
    teamActiveToday,
    teamOnClockPercent,
    clockInsToday: clockEntries.length,
    pendingDeliveries,
    pickupsReady: pickupsRes.count || 0,
    inventoryLotsActive: inventory.length,
    totalStockBars,
    commsToday: commsRes.count || 0,
    publishedPosts,
    scheduledPosts,
    healthScore,
    alerts,
    exceptions,
    pipelineByStage,
    recentOrders,
    machineStatuses,
    dailyProduction,
    arAgingBuckets,
    atRiskJobs,
    capacityForecast,
    blockedJobs,
    qcBacklog,
    revenueHeld,
    slaBreach: { total: slaBreachTotal, leads: slaBreachLeadsRes.count || 0, orders: slaBreachOrdersRes.count || 0 },
  };
}

function formatCurrencySimple(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function useCEODashboard() {
  const { companyId } = useCompanyId();
  return useQuery({
    queryKey: ["ceo-dashboard", companyId],
    queryFn: () => fetchCEOMetrics(companyId!),
    enabled: !!companyId,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
