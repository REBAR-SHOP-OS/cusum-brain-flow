import { useBusinessHeartbeat } from "@/hooks/useBusinessHeartbeat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Globe, Users, Cpu, MessageSquare, ShoppingCart, Target,
  MapPin, TrendingUp, DollarSign, Activity, Clock, Loader2,
  CircleDot, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Section 1: Live Pulse Strip ──────────────────────────────────────────────
function LivePulseStrip({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;
  const pulseItems = [
    {
      label: "Visitors Now",
      value: data.visitors.online.length,
      sub: `${data.visitors.away.length} away`,
      icon: Globe,
      pulse: data.visitors.online.length > 0,
      color: "text-green-500",
    },
    {
      label: "Team On Clock",
      value: `${data.team.clockedIn.length}/${data.team.totalStaff}`,
      sub: `${data.team.totalStaff > 0 ? Math.round((data.team.clockedIn.length / data.team.totalStaff) * 100) : 0}%`,
      icon: Users,
      pulse: false,
      color: "text-blue-500",
    },
    {
      label: "Machines Running",
      value: data.machines.filter((m) => m.status === "running").length,
      sub: `${data.machines.length} total`,
      icon: Cpu,
      pulse: data.machines.some((m) => m.status === "running"),
      color: "text-orange-500",
    },
    {
      label: "Open Chats",
      value: data.conversations.open,
      sub: "active now",
      icon: MessageSquare,
      pulse: data.conversations.open > 0,
      color: "text-purple-500",
    },
    {
      label: "Orders Today",
      value: data.ordersToday,
      sub: "new",
      icon: ShoppingCart,
      pulse: false,
      color: "text-emerald-500",
    },
    {
      label: "Leads Today",
      value: data.leadsToday,
      sub: "captured",
      icon: Target,
      pulse: false,
      color: "text-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {pulseItems.map((item) => (
        <Card key={item.label} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
              {item.pulse && (
                <span className="relative flex h-2 w-2 ml-auto">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
            <div className="text-2xl font-bold tracking-tight">{item.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Section 2: Customer Origins ──────────────────────────────────────────────
function CustomerOrigins({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Live Visitors by City
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.visitorsByCity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visitor location data yet</p>
          ) : (
            <div className="space-y-2">
              {data.visitorsByCity.slice(0, 8).map((city) => (
                <div key={city.city} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-3 w-3 text-green-500" />
                    <span className="text-sm">{city.city}</span>
                    {city.country && (
                      <span className="text-xs text-muted-foreground">({city.country})</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">{city.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Lead Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.leadsBySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads data</p>
          ) : (
            <div className="space-y-3">
              {data.leadsBySource
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((src) => {
                  const max = Math.max(...data.leadsBySource.map((s) => s.count));
                  const pct = max > 0 ? (src.count / max) * 100 : 0;
                  return (
                    <div key={src.source} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{src.source.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">{src.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section 3: Status Board ──────────────────────────────────────────────────
function StatusBoard({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;

  const statusColors: Record<string, string> = {
    running: "bg-green-500",
    idle: "bg-muted-foreground/40",
    blocked: "bg-yellow-500",
    down: "bg-destructive",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Team Presence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" /> Team Presence
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.team.clockedIn.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one clocked in</p>
            ) : (
              data.team.clockedIn.map((member) => (
                <div key={member.profileId} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm truncate flex-1">{member.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(member.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Machine Fleet */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Machine Fleet
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.machines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No machines configured</p>
            ) : (
              data.machines.map((machine) => (
                <div key={machine.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${statusColors[machine.status] || "bg-muted-foreground"}`} />
                  <span className="text-sm truncate flex-1">{machine.name}</span>
                  <Badge variant="outline" className="text-xs capitalize">{machine.status}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Website Visitors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" /> Website Visitors
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.visitors.online.length === 0 && data.visitors.away.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active visitors</p>
            ) : (
              [...data.visitors.online, ...data.visitors.away].map((visitor) => (
                <div key={visitor.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${visitor.status === "online" ? "bg-green-500" : "bg-yellow-500"}`} />
                  <span className="text-sm truncate flex-1">
                    {visitor.visitorName || "Anonymous"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {visitor.city || visitor.currentPage || "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section 4: Spending ──────────────────────────────────────────────────────
function SpendingOverview({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground font-medium">Outstanding Payables</span>
          </div>
          <div className="text-xl font-bold">{formatCurrency(data.spending.payables)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground font-medium">Outstanding Receivables</span>
          </div>
          <div className="text-xl font-bold">{formatCurrency(data.spending.receivables)}</div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {data.leadsByStage
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map((stage) => (
                <Badge key={stage.stage} variant="secondary" className="capitalize">
                  {stage.stage.replace(/_/g, " ")} · {stage.count}
                </Badge>
              ))}
            {data.leadsByStage.length === 0 && (
              <p className="text-sm text-muted-foreground">No pipeline data</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Customers */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Top Customers by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No order data</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {data.topCustomers.map((cust, i) => (
                <div key={cust.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cust.name}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(cust.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section 5: Productivity ──────────────────────────────────────────────────
function ProductivityMetrics({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;

  const pct = data.production.totalTarget > 0
    ? Math.round((data.production.completedToday / data.production.totalTarget) * 100)
    : 0;

  const runningCount = data.machines.filter((m) => m.status === "running").length;
  const machineUtil = data.machines.length > 0
    ? Math.round((runningCount / data.machines.length) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Production Throughput
          </div>
          <div className="text-xl font-bold mb-1">
            {data.production.completedToday.toLocaleString()}{" "}
            <span className="text-sm text-muted-foreground font-normal">
              / {data.production.totalTarget.toLocaleString()} pcs
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">{pct}% complete</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5" /> Machine Utilization
          </div>
          <div className="text-xl font-bold mb-1">{machineUtil}%</div>
          <Progress value={machineUtil} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">
            {runningCount} of {data.machines.length} running
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Team Hours Today
          </div>
          <div className="text-xl font-bold">
            {data.team.clockedIn.length}{" "}
            <span className="text-sm text-muted-foreground font-normal">staff active</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.team.totalStaff - data.team.clockedIn.length} off clock
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section 6: Activity Feed ─────────────────────────────────────────────────
function ActivityFeed({ data }: { data: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!data) return null;

  const eventIcon = (type: string) => {
    if (type.includes("lead")) return <Target className="h-3.5 w-3.5 text-rose-500" />;
    if (type.includes("order")) return <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />;
    if (type.includes("chat") || type.includes("support")) return <MessageSquare className="h-3.5 w-3.5 text-purple-500" />;
    if (type.includes("machine") || type.includes("run")) return <Cpu className="h-3.5 w-3.5 text-orange-500" />;
    if (type.includes("delivery")) return <MapPin className="h-3.5 w-3.5 text-blue-500" />;
    return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" /> Live Activity Feed
          <span className="text-xs text-muted-foreground font-normal">(24h)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.activityFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.activityFeed.map((event) => (
              <div key={event.id} className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
                <div className="mt-0.5">{eventIcon(event.eventType)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {event.description || `${event.eventType} on ${event.entityType}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })} · {event.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function BusinessHeartbeat() {
  const { data, isLoading, error } = useBusinessHeartbeat();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-destructive">Failed to load heartbeat data</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Business Heartbeat
          </h2>
          <p className="text-xs text-muted-foreground">Live · auto-refreshes every 30s</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          LIVE
        </Badge>
      </div>

      <LivePulseStrip data={data} />
      <CustomerOrigins data={data} />
      <StatusBoard data={data} />
      <SpendingOverview data={data} />
      <ProductivityMetrics data={data} />
      <ActivityFeed data={data} />
    </div>
  );
}
