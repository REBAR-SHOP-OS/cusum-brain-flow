import { useCEODashboard } from "@/hooks/useCEODashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Package, Truck, Users, TrendingUp, Clock,
  DollarSign, Zap, Mail, Target, BarChart3, Boxes,
  CircleDot, ArrowUpRight, RefreshCw, Factory,
  MessageSquare, Hash, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";

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

export function CEODashboardView() {
  const { data: m, isLoading } = useCEODashboard();

  if (isLoading || !m) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black italic text-foreground">CEO DASHBOARD</h1>
          <p className="text-sm text-muted-foreground">Loading live data…</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
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

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground tracking-tight">CEO DASHBOARD</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Live overview
            <span className="flex items-center gap-1 text-xs">
              <CircleDot className="w-3 h-3 text-green-500 animate-pulse" />
              Auto-refreshing
            </span>
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5">
          <RefreshCw className="w-3 h-3" />
          {format(new Date(), "h:mm a")}
        </Badge>
      </div>

      {/* ─── Hero KPI Strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={Activity}
          label="Active Orders"
          value={String(m.activeOrders)}
          sub={`${m.activeProjects} projects`}
          accent="text-primary"
        />
        <KPICard
          icon={Factory}
          label="Machines Running"
          value={`${m.machinesRunning}/${m.totalMachines}`}
          sub={`${m.activeRuns} active runs`}
          accent="text-green-500"
          pulse={m.machinesRunning > 0}
        />
        <KPICard
          icon={Clock}
          label="Run Time Today"
          value={formatHours(m.runHoursToday)}
          sub={`${m.activeCutPlans} cut plans active`}
          accent="text-amber-500"
        />
        <KPICard
          icon={Target}
          label="Pipeline Value"
          value={formatCurrency(m.pipelineValue)}
          sub={`${m.openLeads} open leads`}
          accent="text-blue-500"
        />
      </div>

      {/* ─── Production + Financial Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Production Progress */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Production Pulse
              </h2>
              <Badge variant="secondary" className="text-xs">
                {m.productionProgress}% complete
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{m.completedPieces.toLocaleString()} pieces done</span>
                <span>{m.totalPieces.toLocaleString()} total</span>
              </div>
              <Progress value={m.productionProgress} className="h-3" />
            </div>

            {/* Machine Status Grid */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Machine Fleet</p>
              <div className="grid grid-cols-3 gap-2">
                {m.machineStatuses.map((machine) => (
                  <div
                    key={machine.id}
                    className={cn(
                      "rounded-lg p-2.5 border text-center transition-all",
                      machine.status === "running"
                        ? "border-green-500/40 bg-green-500/5"
                        : machine.status === "blocked"
                        ? "border-amber-500/40 bg-amber-500/5"
                        : machine.status === "down"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={cn("w-2 h-2 rounded-full", statusColors[machine.status] || "bg-muted-foreground/30")} />
                      <span className="text-xs font-medium capitalize">{machine.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{machine.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Health */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                Financial Health
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="Outstanding A/R"
                value={formatCurrency(m.outstandingAR)}
                detail={`${m.unpaidInvoices} invoices`}
                trend={m.outstandingAR > 0 ? "alert" : "good"}
              />
              <MetricTile
                label="Active Customers"
                value={String(m.activeCustomers)}
                detail="with active status"
                trend="neutral"
              />
              <MetricTile
                label="Pipeline Value"
                value={formatCurrency(m.pipelineValue)}
                detail={`${m.openLeads} opportunities`}
                trend="good"
              />
              <MetricTile
                label="Stock Inventory"
                value={`${m.totalStockBars} bars`}
                detail={`${m.inventoryLotsActive} active lots`}
                trend="neutral"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Activity Trend + Pipeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Activity Trend */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              7-Day Machine Activity
            </h2>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.dailyProduction} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(parseISO(d), "EEE")}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => format(parseISO(d as string), "EEEE, MMM d")}
                  />
                  <Area
                    type="monotone"
                    dataKey="runs"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#areaGradient)"
                    name="Machine Runs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales Pipeline Funnel */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Sales Pipeline
            </h2>
            {pipelineStages.length > 0 ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineStages} layout="vertical" margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={80}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v} leads`, "Count"]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                      {pipelineStages.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                No pipeline data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Operations Strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniKPI icon={Truck} label="Deliveries" value={m.pendingDeliveries} sub="pending" />
        <MiniKPI icon={ShoppingCart} label="Pickups" value={m.pickupsReady} sub="ready" />
        <MiniKPI icon={Mail} label="Comms Today" value={m.commsToday} sub="messages" />
        <MiniKPI icon={Hash} label="Social Posts" value={m.publishedPosts + m.scheduledPosts} sub={`${m.publishedPosts} published`} />
        <MiniKPI icon={Users} label="Team" value={m.totalTeam} sub={m.teamActiveToday > 0 ? `${m.teamActiveToday} active` : "members"} />
      </div>

      {/* ─── Recent Orders ─── */}
      {m.recentOrders.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              Recent Orders
            </h2>
            <div className="space-y-2">
              {m.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        order.status === "active" && "border-green-500/40 text-green-500",
                        order.status === "pending" && "border-amber-500/40 text-amber-500",
                        order.status === "completed" && "border-muted-foreground/40"
                      )}
                    >
                      {order.status}
                    </Badge>
                    {order.total_amount > 0 && (
                      <span className="text-sm font-bold">{formatCurrency(order.total_amount)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  pulse,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("p-2.5 rounded-xl bg-muted shrink-0", pulse && "animate-pulse")}>
          <Icon className={cn("w-5 h-5", accent)} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black tabular-nums">{value}</p>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend: "good" | "alert" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-1",
        trend === "good" && "border-green-500/20 bg-green-500/5",
        trend === "alert" && "border-amber-500/20 bg-amber-500/5",
        trend === "neutral" && "border-border bg-muted/20"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground/70">{detail}</p>
    </div>
  );
}

function MiniKPI({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums">{value}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground/60">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
