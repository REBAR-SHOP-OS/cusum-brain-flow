import { useState, useEffect } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useLiveMonitorStats, type ProductionJob, type ClearedJob } from "@/hooks/useLiveMonitorStats";
import { useBusinessHeartbeat } from "@/hooks/useBusinessHeartbeat";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Scissors, Circle, Activity, Play, ChevronRight, Clock,
  Loader2, Truck, Wrench, Zap, Users, Cpu, Globe,
  Target, ShoppingCart, TrendingUp, AlertTriangle,
  Timer, Signal, Gauge, BarChart3,
} from "lucide-react";
import type { LiveMachine } from "@/types/machine";

const machineTypeIcon: Record<string, React.ElementType> = {
  cutter: Scissors,
  bender: Circle,
  other: Wrench,
  loader: Truck,
};

/** Format seconds into "Xh Ym Zs" */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}HR ${m}M ${s}S`;
  if (m > 0) return `${m}M ${s}S`;
  return `${s}S`;
}

/** Deterministic color from string */
function hashColor(str: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500",
    "bg-teal-500", "bg-pink-500", "bg-cyan-500", "bg-amber-500",
    "bg-indigo-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/** Live clock component */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-white/60">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

/* ────────────────────────────────────────────────── */
/*  Live Pulse Strip — KPIs across the top           */
/* ────────────────────────────────────────────────── */
function PulseStrip({ heartbeat, machines, totalPcs, totalTonnage }: {
  heartbeat: ReturnType<typeof useBusinessHeartbeat>["data"];
  machines: LiveMachine[];
  totalPcs: number;
  totalTonnage: number;
}) {
  const running = machines.filter(m => m.status === "running").length;
  const util = machines.length > 0 ? Math.round((running / machines.length) * 100) : 0;

  const items = [
    {
      label: "Machines",
      value: `${running}/${machines.length}`,
      sub: `${util}% utilization`,
      icon: Cpu,
      pulse: running > 0,
      color: "text-orange-400",
    },
    {
      label: "Tonnage",
      value: `${(totalTonnage / 1000).toFixed(1)}T`,
      sub: `${totalTonnage.toFixed(0)} KG`,
      icon: Gauge,
      pulse: false,
      color: "text-emerald-400",
    },
    {
      label: "PCS Cut",
      value: totalPcs.toLocaleString(),
      sub: "logged",
      icon: BarChart3,
      pulse: false,
      color: "text-blue-400",
    },
    {
      label: "Team Active",
      value: heartbeat ? `${heartbeat.team.clockedIn.length}` : "—",
      sub: heartbeat ? `of ${heartbeat.team.totalStaff}` : "",
      icon: Users,
      pulse: false,
      color: "text-violet-400",
    },
    {
      label: "Visitors",
      value: heartbeat ? `${heartbeat.visitors.online.length}` : "—",
      sub: heartbeat ? `${heartbeat.visitors.away.length} away` : "",
      icon: Globe,
      pulse: heartbeat ? heartbeat.visitors.online.length > 0 : false,
      color: "text-cyan-400",
    },
    {
      label: "Leads Today",
      value: heartbeat ? `${heartbeat.leadsToday}` : "—",
      sub: "captured",
      icon: Target,
      pulse: false,
      color: "text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map((item) => (
        <div key={item.label} className="relative rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm p-3 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</span>
            {item.pulse && (
              <span className="relative flex h-1.5 w-1.5 ml-auto">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
            )}
          </div>
          <div className="text-xl font-black tabular-nums tracking-tight text-foreground">{item.value}</div>
          <div className="text-[10px] text-muted-foreground/70">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Machine Gauge Card — enhanced with operator info */
/* ────────────────────────────────────────────────── */
function MachineGaugeCard({ machine }: { machine: LiveMachine }) {
  const isRunning = machine.status === "running";
  const isDown = machine.status === "down";
  const isBlocked = machine.status === "blocked";
  const Icon = machineTypeIcon[machine.type] || Wrench;

  const borderClass = isRunning
    ? "border-primary/50 bg-primary/5 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.25)]"
    : isDown
    ? "border-destructive/40 bg-destructive/5"
    : isBlocked
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-border/40 bg-card/50";

  const statusColor = isRunning ? "text-green-400" : isDown ? "text-destructive" : isBlocked ? "text-amber-500" : "text-muted-foreground/50";

  // Calculate run duration if running
  const runDuration = isRunning && machine.current_run?.started_at
    ? formatElapsed(Math.floor((Date.now() - new Date(machine.current_run.started_at).getTime()) / 1000))
    : null;

  return (
    <div className={`relative flex flex-col items-center justify-between gap-1 p-4 rounded-xl border min-w-[150px] max-w-[170px] transition-all ${borderClass}`}>
      {/* Status dot */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : isDown ? "bg-destructive" : isBlocked ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/30"}`} />
      </div>

      {/* Queue count badge */}
      {machine.queued_runs && machine.queued_runs.length > 0 && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4">
            {machine.queued_runs.length}Q
          </Badge>
        </div>
      )}

      {/* Gauge ring */}
      <div className="w-14 h-14 relative flex items-center justify-center mt-1">
        <svg viewBox="0 0 64 64" className="w-full h-full">
          <circle
            cx="32" cy="32" r="26"
            fill="none"
            stroke={isRunning ? "hsl(var(--primary))" : isDown ? "hsl(var(--destructive))" : "hsl(var(--muted))"}
            strokeWidth="3"
            strokeDasharray={isRunning ? "130 34" : isDown ? "20 20" : "10 10"}
            strokeLinecap="round"
            opacity={isRunning ? 0.7 : 0.3}
            className={isRunning ? "animate-spin" : ""}
            style={isRunning ? { animationDuration: "2.5s" } : {}}
          />
        </svg>
        <Icon className={`absolute w-5 h-5 ${isRunning ? "text-primary" : "text-muted-foreground/40"}`} />
      </div>

      {/* Name & status */}
      <div className="text-center space-y-0.5">
        <p className="text-[11px] font-bold tracking-wider text-foreground uppercase leading-tight">{machine.name}</p>
        <p className={`text-[9px] font-semibold uppercase tracking-[0.2em] ${statusColor}`}>
          {machine.status.toUpperCase()}
        </p>
      </div>

      {/* Operator */}
      {machine.operator?.full_name && (
        <p className="text-[9px] text-muted-foreground/70 truncate max-w-full">
          {machine.operator.full_name}
        </p>
      )}

      {/* Run timer */}
      {runDuration && (
        <div className="flex items-center gap-1 text-[9px] text-primary/70 font-mono">
          <Signal className="w-2.5 h-2.5" />
          {runDuration}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Production Ledger Card                           */
/* ────────────────────────────────────────────────── */
function LedgerCard({ job }: { job: ProductionJob }) {
  const progress = job.total_pieces > 0
    ? Math.round((job.completed_pieces / job.total_pieces) * 100)
    : 0;

  const now = Date.now();
  const elapsed = Math.floor((now - new Date(job.created_at).getTime()) / 1000);

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    running: { label: "ACTIVE", variant: "default" },
    staged: { label: "STAGED", variant: "secondary" },
    queued: { label: "QUEUED", variant: "secondary" },
    ready: { label: "READY", variant: "secondary" },
    draft: { label: "DRAFT", variant: "outline" },
  };
  const st = statusMap[job.status] || statusMap.draft;

  const weightKg = job.total_weight_kg;
  const completedWeightKg = job.completed_weight_kg;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 hover:border-border transition-all group">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black uppercase text-foreground tracking-tight truncate">
            {job.project_name || job.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={st.variant} className="text-[8px] uppercase tracking-widest h-4">
              {st.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatElapsed(elapsed)}
            </span>
            {weightKg > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {completedWeightKg.toFixed(0)}/{weightKg.toFixed(0)} KG
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className={`text-3xl font-black italic tabular-nums ${
            progress >= 100 ? "text-green-500" : progress >= 50 ? "text-foreground" : "text-foreground/80"
          }`}>{progress}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted/50 rounded-full h-1.5 mb-2 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${
            progress >= 100 ? "bg-green-500" : "bg-primary"
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Circle className="w-2.5 h-2.5" /> {job.completed_pieces.toLocaleString()} / {job.total_pieces.toLocaleString()} UNITS
        </span>
        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Process Clearance Item                           */
/* ────────────────────────────────────────────────── */
function ClearanceItem({ job }: { job: ClearedJob }) {
  const bgColor = hashColor(job.name);
  const statusLabel = job.status === "delivered" ? "DELIVERED" : "FABRICATION DONE";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
      <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
        {job.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate uppercase">{job.name}</p>
        <p className="text-[9px] text-muted-foreground uppercase">{statusLabel}</p>
      </div>
      <span className="text-[9px] text-muted-foreground/60 shrink-0">
        {job.completed_pieces}/{job.total_pieces}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  SLA Alert Strip — inline warnings                */
/* ────────────────────────────────────────────────── */
function SLAAlertStrip({ heartbeat }: { heartbeat: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!heartbeat) return null;

  // Show production throughput + machine utilization inline
  const runningCount = heartbeat.machines.filter(m => m.status === "running").length;
  const utilPct = heartbeat.machines.length > 0 ? Math.round((runningCount / heartbeat.machines.length) * 100) : 0;
  const prodPct = heartbeat.production.totalTarget > 0
    ? Math.round((heartbeat.production.completedToday / heartbeat.production.totalTarget) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Production throughput */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Production Throughput</span>
        </div>
        <div className="text-lg font-bold tabular-nums">
          {heartbeat.production.completedToday.toLocaleString()}
          <span className="text-xs text-muted-foreground font-normal ml-1">
            / {heartbeat.production.totalTarget.toLocaleString()} pcs
          </span>
        </div>
        <Progress value={prodPct} className="h-1.5 mt-2" />
      </div>

      {/* Machine utilization */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Machine Utilization</span>
        </div>
        <div className="text-lg font-bold tabular-nums">
          {utilPct}%
          <span className="text-xs text-muted-foreground font-normal ml-1">
            {runningCount} of {heartbeat.machines.length} running
          </span>
        </div>
        <Progress value={utilPct} className="h-1.5 mt-2" />
      </div>

      {/* Financial snapshot */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cash Position</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Receivables</p>
            <p className="text-sm font-bold text-green-500 tabular-nums">
              ${(heartbeat.spending.receivables / 1000).toFixed(0)}K
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Payables</p>
            <p className="text-sm font-bold text-amber-500 tabular-nums">
              ${(heartbeat.spending.payables / 1000).toFixed(0)}K
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Activity Feed — last 8 events                    */
/* ────────────────────────────────────────────────── */
function ActivityTicker({ heartbeat }: { heartbeat: ReturnType<typeof useBusinessHeartbeat>["data"] }) {
  if (!heartbeat || heartbeat.activityFeed.length === 0) return null;

  const eventIcon = (type: string) => {
    if (type.includes("lead")) return <Target className="h-3 w-3 text-rose-400" />;
    if (type.includes("order")) return <ShoppingCart className="h-3 w-3 text-emerald-400" />;
    if (type.includes("machine") || type.includes("cut") || type.includes("bend")) return <Cpu className="h-3 w-3 text-orange-400" />;
    return <Activity className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Activity Feed</span>
      </div>
      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
        {heartbeat.activityFeed.slice(0, 10).map((event) => (
          <div key={event.id} className="flex items-center gap-2 py-1">
            {eventIcon(event.eventType)}
            <span className="text-xs text-foreground/80 flex-1 truncate">{event.description}</span>
            <span className="text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">
              {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Main View                                        */
/* ────────────────────────────────────────────────── */
export function LiveMonitorView() {
  const { machines, isLoading: machinesLoading } = useLiveMonitorData();
  const { activeJobs, clearedJobs, totalTonnage, totalPcsLogged, jobsLoading } = useLiveMonitorStats();
  const { data: heartbeat } = useBusinessHeartbeat();

  const isLoading = machinesLoading || jobsLoading;
  const runningMachines = machines.filter(m => m.status === "running").length;

  return (
    <div className="flex flex-col h-full">
      {/* Hero Banner */}
      <div className="bg-[hsl(220,25%,10%)] text-white px-6 py-5 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] tracking-[0.3em] text-green-400 uppercase font-medium">
              Production Monitor · Live
            </span>
            <LiveClock />
          </div>
          <div className="flex items-center gap-1.5">
            <Signal className={`w-3.5 h-3.5 ${runningMachines > 0 ? "text-green-400" : "text-muted-foreground/40"}`} />
            <span className="text-[10px] text-white/40 tracking-wider uppercase">
              {runningMachines} active
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight uppercase">Shop Floor HUD</h1>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[9px] tracking-[0.2em] text-white/40 uppercase">Tonnage</p>
              <p className="text-3xl font-black italic tabular-nums leading-none">
                {totalTonnage.toFixed(1)} <span className="text-sm font-medium text-white/50">KG</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] tracking-[0.2em] text-white/40 uppercase">Pieces</p>
              <p className="text-3xl font-black italic tabular-nums leading-none">
                {totalPcsLogged.toLocaleString()} <span className="text-sm font-medium text-white/50">PCS</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* KPI Pulse Strip */}
            <PulseStrip
              heartbeat={heartbeat ?? null}
              machines={machines}
              totalPcs={totalPcsLogged}
              totalTonnage={totalTonnage}
            />

            {/* Machine Cards Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs font-black tracking-[0.2em] text-foreground uppercase">
                  Shop Units Real-Time
                </h2>
                <span className="text-[9px] text-muted-foreground ml-auto uppercase tracking-wider">
                  {machines.length} machines
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {machines.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6">No machines configured</p>
                ) : (
                  machines.map((machine) => (
                    <MachineGaugeCard key={machine.id} machine={machine} />
                  ))
                )}
              </div>
            </section>

            {/* Operational Metrics */}
            <SLAAlertStrip heartbeat={heartbeat ?? null} />

            {/* Production Ledger + Process Clearances + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
              {/* Left: Production Ledger */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-500" />
                    <h2 className="text-xs font-black tracking-[0.2em] text-foreground uppercase">
                      Production Ledger
                    </h2>
                  </div>
                  <span className="text-[9px] tracking-widest text-muted-foreground uppercase">
                    {activeJobs.length} Jobs
                  </span>
                </div>

                {activeJobs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                    <p className="text-sm text-muted-foreground">No active production jobs</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeJobs.map((job) => (
                      <LedgerCard key={job.id} job={job} />
                    ))}
                  </div>
                )}
              </section>

              {/* Right: Clearances + Activity Feed */}
              <div className="space-y-5">
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-xs font-black tracking-[0.2em] text-foreground uppercase">
                      Process Clearances
                    </h2>
                  </div>

                  {clearedJobs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/40 p-5 text-center">
                      <p className="text-sm text-muted-foreground">No cleared jobs yet</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-0">
                      {clearedJobs.map((job) => (
                        <ClearanceItem key={job.id} job={job} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Activity feed */}
                <ActivityTicker heartbeat={heartbeat ?? null} />
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
