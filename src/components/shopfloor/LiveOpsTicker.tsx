import { useNavigate } from "react-router-dom";
import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleDot,
  Hammer,
  Layers,
  PauseCircle,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectLane } from "@/hooks/useProductionQueues";
import type { LiveMachine } from "@/types/machine";

type Tone = "default" | "success" | "info" | "warning" | "destructive";

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
};

type Item = {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: Tone;
  onClick?: () => void;
};

/**
 * Shop-floor "Live Ops Ticker" — compact horizontally-scrolling marquee strip
 * showing real-time station + queue counts. Ported visual from REBAR OS Core.
 * Data is derived from props already loaded by the parent dashboard — no new
 * backend calls.
 */
export function LiveOpsTicker({
  machines,
  lanes,
  readyCounts,
}: {
  machines: LiveMachine[];
  lanes: ProjectLane[];
  readyCounts: { total: number; pickup: number; loading: number; delivery: number };
}) {
  const navigate = useNavigate();

  const running = machines.filter((m) => m.status === "running").length;
  const idle = machines.filter((m) => m.status === "idle").length;
  const blocked = machines.filter((m) => m.status === "blocked").length;
  const down = machines.filter((m) => m.status === "down").length;

  const allItems = lanes.flatMap((l) => l.items);
  const queued = allItems.filter((i) => i.status === "queued").length;
  const runningItems = allItems.filter((i) => i.status === "running").length;

  const cutting = allItems.filter(
    (i) => i.status === "running" && i.task?.task_type === "cut",
  ).length;
  const bending = allItems.filter(
    (i) => i.status === "running" && i.task?.task_type === "bend",
  ).length;

  const items: Item[] = [
    {
      label: "Loading queue",
      value: readyCounts.total,
      icon: Truck,
      tone: readyCounts.total > 0 ? "success" : "default",
      onClick: () => navigate("/shopfloor/loading"),
    },
    { label: "Running", value: running, icon: CircleDot, tone: "success" },
    { label: "Idle", value: idle, icon: PauseCircle },
    { label: "Blocked", value: blocked, icon: Wrench, tone: "warning" },
    { label: "Down", value: down, icon: Wrench, tone: "destructive" },
    { label: "Queued", value: queued, icon: Layers },
    { label: "Cutting", value: cutting, icon: Hammer, tone: "info" },
    { label: "Bending", value: bending, icon: Hammer, tone: "info" },
    { label: "Clearance", value: readyCounts.loading, icon: ShieldCheck, tone: "warning" },
    { label: "Complete", value: readyCounts.delivery, icon: CheckCircle2, tone: "success" },
    { label: "Ready", value: readyCounts.pickup, icon: Boxes, tone: "success" },
    { label: "In progress", value: runningItems, icon: Activity, tone: "info" },
  ];

  // Duplicate for seamless marquee loop
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-background/40 px-3 py-1.5">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live Ops Ticker
        </span>
      </div>
      <style>{`@keyframes shopfloor-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      <div className="group relative">
        <div
          className="flex w-max gap-0 group-hover:[animation-play-state:paused]"
          style={{ animation: "shopfloor-ticker 60s linear infinite" }}
        >
          {loop.map((it, i) => {
            const Icon = it.icon;
            const Comp: any = it.onClick ? "button" : "div";
            return (
              <Comp
                key={i}
                onClick={it.onClick}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-r border-border px-4 py-2.5 text-left transition-colors",
                  it.onClick && "hover:bg-accent/40 cursor-pointer",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 opacity-60", TONE[it.tone ?? "default"])} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </span>
                <span className={cn("text-sm font-semibold tabular-nums", TONE[it.tone ?? "default"])}>
                  {it.value}
                </span>
              </Comp>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent" />
      </div>
    </div>
  );
}
