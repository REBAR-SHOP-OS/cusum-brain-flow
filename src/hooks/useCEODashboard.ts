import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CEOAlert {
  type: "error" | "warning";
  message: string;
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

async function fetchCEOMetrics(): Promise<CEOMetrics> {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    projectsRes, ordersRes, cutItemsRes, machinesRes,
    deliveriesRes, leadsRes, customersRes, profilesRes,
    clockRes, inventoryRes, commsRes, socialRes,
    accountingRes, runsRes, cutPlansRes, pickupsRes,
    recentOrdersRes, pipelineRes, dailyRunsRes,
  ] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["active", "pending"]),
    supabase.from("cut_plan_items").select("total_pieces, completed_pieces"),
    supabase.from("machines").select("id, name, type, status"),
    supabase.from("deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "in_transit", "loading"]),
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
    supabase.from("orders").select("id, order_number, status, total_amount, customer_id, order_date, customers(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("stage, expected_value"),
    supabase.from("machine_runs").select("started_at, status").gte("started_at", weekAgo),
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

  // Accounting - split unpaid vs overdue
  const allInvoices = accountingRes.data || [];
  const unpaidInvoices = allInvoices.filter((i) => (i.balance || 0) > 0);
  const outstandingAR = unpaidInvoices.reduce((s, i) => s + (i.balance || 0), 0);
  // Estimate overdue: invoices with balance > 0 (simplified - all unpaid treated as potentially overdue)
  const overdueInvoices = unpaidInvoices.length;

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

  const machineStatuses = machines.map((m) => ({ id: m.id, name: m.name, type: m.type, status: m.status }));

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
    pipelineByStage,
    recentOrders,
    machineStatuses,
    dailyProduction,
  };
}

function formatCurrencySimple(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function useCEODashboard() {
  return useQuery({
    queryKey: ["ceo-dashboard"],
    queryFn: fetchCEOMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
