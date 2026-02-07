import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useLiveMonitorStats, type ProductionJob, type ClearedJob } from "@/hooks/useLiveMonitorStats";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scissors, Circle, Activity, Play, ChevronRight, Clock, Loader2, Truck, RotateCcw, Wrench } from "lucide-react";
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

/* ────────────────────────────────────────────────── */
/*  Machine Gauge Card                               */
/* ────────────────────────────────────────────────── */
function MachineGaugeCard({ machine }: { machine: LiveMachine }) {
  const isRunning = machine.status === "running";
  const Icon = machineTypeIcon[machine.type] || Wrench;

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border min-w-[160px] transition-all ${
        isRunning
          ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.2)]"
          : "border-border/50 bg-card/60"
      }`}
    >
      {/* Status dot */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
      </div>

      {/* Machine icon */}
      <div className="flex items-center gap-2 mt-2">
        <Icon className={`w-4 h-4 ${isRunning ? "text-primary" : "text-muted-foreground/50"}`} />
      </div>

      {/* Name & status */}
      <div className="text-center">
        <p className="text-xs font-bold tracking-wider text-foreground uppercase">{machine.name}</p>
        <p className={`text-[10px] font-semibold uppercase tracking-widest ${
          isRunning ? "text-green-500" : "text-muted-foreground/60"
        }`}>
          {machine.status.toUpperCase()}
        </p>
      </div>

      {/* Gauge visual */}
      <div className="w-16 h-16 relative flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-full h-full">
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={isRunning ? "hsl(var(--primary))" : "hsl(var(--muted))"}
            strokeWidth="3"
            strokeDasharray={isRunning ? "120 56" : "10 10"}
            strokeLinecap="round"
            opacity={isRunning ? 0.6 : 0.3}
            className={isRunning ? "animate-spin" : ""}
            style={isRunning ? { animationDuration: "3s" } : {}}
          />
        </svg>
      </div>
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

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-black uppercase text-foreground tracking-tight">
            {job.project_name || job.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={st.variant} className="text-[9px] uppercase tracking-widest">
              {st.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatElapsed(elapsed)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black italic text-foreground tabular-nums">{progress}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-2 overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Circle className="w-3 h-3" /> {job.completed_pieces} / {job.total_pieces} UNITS
        </span>
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Process Clearance Item                           */
/* ────────────────────────────────────────────────── */
function ClearanceItem({ job }: { job: ClearedJob }) {
  const bgColor = hashColor(job.name);
  const statusLabel = job.status === "delivered" ? "DELIVERY COMPLETE." : "FABRICATION COMPLETE.";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className={`w-7 h-7 rounded-full ${bgColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
        {job.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate uppercase">{job.name}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{statusLabel}</p>
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

  const isLoading = machinesLoading || jobsLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Hero Banner */}
      <div className="bg-[hsl(220,25%,12%)] text-white px-8 py-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] tracking-[0.3em] text-green-400 uppercase font-medium">
              Production Monitor · Live
            </span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tight uppercase">Shop Floor HUD</h1>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-white/50 uppercase">Real-Time Tonnage</p>
            <p className="text-4xl font-black italic tabular-nums">
              {totalTonnage.toFixed(1)} <span className="text-base font-medium text-white/60">KG</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-white/50 uppercase">PCS Logged</p>
            <p className="text-4xl font-black italic tabular-nums">
              {totalPcsLogged} <span className="text-base font-medium text-white/60">PCS</span>
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Machine Cards Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                  Shop Units Real-Time
                </h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {machines.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6">No machines configured</p>
                ) : (
                  machines.map((machine) => (
                    <MachineGaugeCard key={machine.id} machine={machine} />
                  ))
                )}
              </div>
            </section>

            {/* Production Ledger + Process Clearances */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* Production Ledger */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-500" />
                    <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                      Production Ledger
                    </h2>
                  </div>
                  <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {activeJobs.length} Jobs Monitoring
                  </span>
                </div>

                {activeJobs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">No active production jobs</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeJobs.map((job) => (
                      <LedgerCard key={job.id} job={job} />
                    ))}
                  </div>
                )}
              </section>

              {/* Process Clearances */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                    Process Clearances
                  </h2>
                </div>

                {clearedJobs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">No cleared jobs yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {clearedJobs.map((job) => (
                      <ClearanceItem key={job.id} job={job} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
