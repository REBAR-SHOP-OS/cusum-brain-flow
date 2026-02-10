import { useState } from "react";
import { useCEODashboard } from "@/hooks/useCEODashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Package, Truck, Users, Clock,
  DollarSign, Zap, Mail, Target, BarChart3, Boxes,
  CircleDot, RefreshCw, Factory,
  Hash, ShoppingCart, AlertTriangle,
  X, Weight, Percent, UserCheck, Gauge, AlertCircle,
  Wallet, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

import { HealthScoreHero } from "@/components/ceo/HealthScoreHero";
import { KpiCard } from "@/components/ceo/KpiCard";
import { ExceptionsWorkbench } from "@/components/ceo/ExceptionsWorkbench";
import { ARWorkbenchDrawer } from "@/components/ceo/drawers/ARWorkbenchDrawer";
import { JobRiskDrawer } from "@/components/ceo/drawers/JobRiskDrawer";
import { CapacityDrawer } from "@/components/ceo/drawers/CapacityDrawer";

/* ─── Helpers ─── */

const statusColors: Record<string, string> = {
  running: "bg-green-500",
  idle: "bg-muted-foreground/30",
  blocked: "bg-amber-500",
  down: "bg-destructive",
};

const stageLabels: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "hsl(var(--primary))" },
  contacted: { label: "Contacted", color: "hsl(210, 80%, 55%)" },
  qualified: { label: "Qualified", color: "hsl(180, 70%, 45%)" },
  proposal: { label: "Proposal", color: "hsl(45, 90%, 50%)" },
  negotiation: { label: "Negotiation", color: "hsl(30, 85%, 50%)" },
  closed_won: { label: "Won", color: "hsl(140, 70%, 45%)" },
  closed_lost: { label: "Lost", color: "hsl(0, 60%, 50%)" },
};

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Main Component ─── */

export function CEODashboardView() {
  const { data: m, isLoading } = useCEODashboard();
  const queryClient = useQueryClient();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ceo-dashboard"] });
  };

  if (isLoading || !m) {
    return (
      <div className="p-6 space-y-6 max-w-[1440px]">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const pipelineStages = Object.entries(m.pipelineByStage)
    .filter(([stage]) => stage !== "closed_lost")
    .map(([stage, data]) => ({
      stage,
      label: stageLabels[stage]?.label || stage,
      color: stageLabels[stage]?.color || "hsl(var(--muted-foreground))",
      ...data,
    }));

  const visibleAlerts = (m.alerts || []).filter((a) => !dismissedAlerts.has(a.message));

  const donutData = [
    { name: "Completed", value: m.completedPieces, fill: "hsl(var(--success))" },
    { name: "Remaining", value: Math.max(0, m.totalPieces - m.completedPieces), fill: "hsl(var(--muted))" },
  ];

  const totalOrderValue = m.recentOrders.reduce((s, o) => s + o.total_amount, 0);

  // Health drivers for the hero
  const healthDrivers = [
    { label: "Cash", score: Math.min(100, m.pipelineValue > 0 ? Math.round(100 - (m.outstandingAR / m.pipelineValue) * 100) : 50), icon: <Wallet className="w-3.5 h-3.5 text-emerald-500" /> },
    { label: "Ops", score: m.totalMachines > 0 ? Math.round((m.machinesRunning / m.totalMachines) * 100) : 50, icon: <Factory className="w-3.5 h-3.5 text-primary" /> },
    { label: "Sales", score: Math.min(100, Math.round(m.openLeads * 8)), icon: <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> },
    { label: "Delivery", score: m.pendingDeliveries > 5 ? 40 : m.pendingDeliveries > 2 ? 65 : 90, icon: <Truck className="w-3.5 h-3.5 text-amber-500" /> },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1440px]">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {getGreeting()}, CEO
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
            Business Command Center
            <span className="flex items-center gap-1 text-xs">
              <CircleDot className="w-3 h-3 text-green-500 animate-pulse" />
              Live
            </span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          {format(new Date(), "h:mm a")}
        </Button>
      </motion.div>

      {/* ─── Alerts Banner ─── */}
      <AnimatePresence>
        {visibleAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {visibleAlerts.map((alert) => (
              <motion.div
                key={alert.message}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm backdrop-blur-sm",
                  alert.type === "error"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                )}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{alert.message}</span>
                </div>
                <button
                  onClick={() => setDismissedAlerts((prev) => new Set(prev).add(alert.message))}
                  className="p-1 rounded hover:bg-foreground/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Health Score Hero ─── */}
      <HealthScoreHero score={m.healthScore} drivers={healthDrivers} />

      {/* ─── KPI Grid (6 cards) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard index={0} icon={<DollarSign className="w-4 h-4 text-emerald-500" />} label="Outstanding A/R" value={formatCurrency(m.outstandingAR)} sub={`${m.unpaidInvoices} invoices • ${m.overdueInvoices} overdue`} alertActive={m.overdueInvoices > 5} onClick={() => setOpenDrawer("ar")} />
        <KpiCard index={1} icon={<Gauge className="w-4 h-4 text-primary" />} label="Capacity Util." value={`${m.totalMachines > 0 ? Math.round((m.machinesRunning / m.totalMachines) * 100) : 0}%`} sub={`${m.machinesRunning}/${m.totalMachines} machines`} onClick={() => setOpenDrawer("capacity")} />
        <KpiCard index={2} icon={<AlertCircle className="w-4 h-4 text-destructive" />} label="Jobs at Risk" value={String(m.machineStatuses.filter((ms) => ms.status === "blocked" || ms.status === "down").length)} sub="capacity conflicts" alertActive={m.machineStatuses.filter((ms) => ms.status === "down").length >= 1} onClick={() => setOpenDrawer("risk")} />
        <KpiCard index={3} icon={<Clock className="w-4 h-4 text-amber-500" />} label="Runtime Today" value={formatHours(m.runHoursToday)} sub={`${m.activeRuns} active runs`} />
        <KpiCard index={4} icon={<Target className="w-4 h-4 text-blue-500" />} label="Weighted Pipeline" value={formatCurrency(m.pipelineValue)} sub={`${m.openLeads} leads`} />
        <KpiCard index={5} icon={<UserCheck className="w-4 h-4 text-violet-500" />} label="Team On Clock" value={`${m.teamActiveToday}/${m.totalTeam}`} sub={`${m.teamOnClockPercent}% present`} />
      </div>

      {/* ─── Production + Financial Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Production Pulse */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Production Pulse
                </h2>
                <Badge variant="secondary" className="text-xs">{m.productionProgress}%</Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{m.completedPieces.toLocaleString()} pieces done</span>
                  <span>{m.totalPieces.toLocaleString()} total</span>
                </div>
                <Progress value={m.productionProgress} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
                  <Weight className="w-4 h-4 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold tabular-nums">{m.tonnageToday}t</p>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Tonnage Est.</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
                  <Percent className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                  <p className="text-lg font-bold tabular-nums">{m.scrapRate}%</p>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Scrap Rate</p>
                </div>
              </div>

              {/* Machine Fleet */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Machine Fleet</p>
                <div className="grid grid-cols-3 gap-2">
                  {m.machineStatuses.map((machine) => (
                    <div
                      key={machine.id}
                      className={cn(
                        "rounded-lg p-2 border text-center transition-all",
                        machine.status === "running" ? "border-green-500/30 bg-green-500/5"
                          : machine.status === "blocked" ? "border-amber-500/30 bg-amber-500/5"
                          : machine.status === "down" ? "border-destructive/30 bg-destructive/5"
                          : "border-border/50 bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <div className={cn("w-2 h-2 rounded-full", statusColors[machine.status] || "bg-muted-foreground/30", machine.status === "running" && "animate-pulse")} />
                        <span className="text-[11px] font-medium capitalize">{machine.status}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{machine.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Financial Health */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  Financial Health
                </h2>
                {m.overdueInvoices > 0 && (
                  <Badge variant="destructive" className="text-xs">{m.overdueInvoices} overdue</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Outstanding A/R" value={formatCurrency(m.outstandingAR)} detail={`${m.unpaidInvoices} invoices`} trend={m.outstandingAR > 0 ? "alert" : "good"} />
                <MetricTile label="Active Customers" value={String(m.activeCustomers)} detail="with active status" trend="neutral" />
                <MetricTile label="Pipeline Value" value={formatCurrency(m.pipelineValue)} detail={`${m.openLeads} opportunities`} trend="good" />
                <MetricTile label="Stock Inventory" value={`${m.totalStockBars} bars`} detail={`${m.inventoryLotsActive} active lots`} trend="neutral" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                7-Day Activity
              </h2>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.dailyProduction} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "EEE")} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} labelFormatter={(d) => format(parseISO(d as string), "EEEE, MMM d")} />
                    <Area type="monotone" dataKey="runs" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#areaGrad)" name="Runs" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                Sales Pipeline
              </h2>
              {pipelineStages.length > 0 ? (
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineStages} layout="vertical" margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v} leads`, "Count"]} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                        {pipelineStages.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">No pipeline data</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                Production Target
              </h2>
              <div className="h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [v.toLocaleString(), "Pieces"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl font-black tabular-nums">{m.productionProgress}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Complete</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Operations Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Truck, label: "Deliveries", value: m.pendingDeliveries, sub: "pending" },
          { icon: ShoppingCart, label: "Pickups", value: m.pickupsReady, sub: "ready" },
          { icon: Mail, label: "Comms Today", value: m.commsToday, sub: "messages" },
          { icon: Hash, label: "Social Posts", value: m.publishedPosts + m.scheduledPosts, sub: `${m.publishedPosts} published` },
          { icon: Users, label: "Team", value: m.totalTeam, sub: m.teamActiveToday > 0 ? `${m.teamActiveToday} active` : "members" },
          { icon: Boxes, label: "Inventory", value: m.totalStockBars, sub: `${m.inventoryLotsActive} lots` },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.04 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 rounded-xl">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-muted/50">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums leading-tight">{item.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground/70">{item.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── Exceptions Workbench ─── */}
      <ExceptionsWorkbench />

      {/* ─── Recent Orders ─── */}
      {m.recentOrders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                Recent Orders
              </h2>
              <div className="space-y-2">
                {m.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.order_date && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {format(parseISO(order.order_date), "MMM d")}
                        </span>
                      )}
                      <Badge variant="outline" className={cn("text-xs capitalize", order.status === "active" && "border-green-500/40 text-green-500", order.status === "pending" && "border-amber-500/40 text-amber-500", order.status === "completed" && "border-muted-foreground/40")}>
                        {order.status}
                      </Badge>
                      {order.total_amount > 0 && (
                        <span className="text-sm font-bold tabular-nums">{formatCurrency(order.total_amount)}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-2">
                  <span className="text-xs font-medium text-muted-foreground">{m.recentOrders.length} orders shown</span>
                  <span className="text-sm font-bold">Total: {formatCurrency(totalOrderValue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Drilldown Drawers ─── */}
      <ARWorkbenchDrawer open={openDrawer === "ar"} onClose={() => setOpenDrawer(null)} outstandingAR={m.outstandingAR} unpaidInvoices={m.unpaidInvoices} />
      <JobRiskDrawer open={openDrawer === "risk"} onClose={() => setOpenDrawer(null)} />
      <CapacityDrawer open={openDrawer === "capacity"} onClose={() => setOpenDrawer(null)} />
    </div>
  );
}

/* ─── Sub-components ─── */

function MetricTile({ label, value, detail, trend }: {
  label: string; value: string; detail: string; trend: "good" | "alert" | "neutral";
}) {
  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-1",
      trend === "good" && "border-green-500/20 bg-green-500/5",
      trend === "alert" && "border-amber-500/20 bg-amber-500/5",
      trend === "neutral" && "border-border/50 bg-muted/20"
    )}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground/70">{detail}</p>
    </div>
  );
}
