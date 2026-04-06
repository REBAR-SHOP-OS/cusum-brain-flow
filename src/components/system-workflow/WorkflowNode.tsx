import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronRight, Layers, Link2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModuleStatus, WorkflowLayerGroup } from "@/types/workflowDiagram";

export type WorkflowNodeData = {
  moduleId: string;
  title: string;
  subtitle: string;
  group: WorkflowLayerGroup;
  status: ModuleStatus;
  hint: string;
  hasChildren: boolean;
  errorCount: number;
  warningCount: number;
  dimmed: boolean;
  selected: boolean;
};

const groupAccent: Record<WorkflowLayerGroup, { border: string; glow: string; icon: string }> = {
  user_interface: {
    border: "border-cyan-400/80",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.30)]",
    icon: "text-cyan-200",
  },
  app_auth: {
    border: "border-sky-400/70",
    glow: "shadow-[0_0_22px_rgba(56,189,248,0.25)]",
    icon: "text-sky-200",
  },
  core_data_api: {
    border: "border-orange-400/80",
    glow: "shadow-[0_0_30px_rgba(251,146,60,0.45)]",
    icon: "text-orange-100",
  },
  automation_signals: {
    border: "border-emerald-400/75",
    glow: "shadow-[0_0_22px_rgba(52,211,153,0.25)]",
    icon: "text-emerald-200",
  },
  external_integrations: {
    border: "border-violet-400/75",
    glow: "shadow-[0_0_24px_rgba(167,139,250,0.30)]",
    icon: "text-violet-200",
  },
  monitoring_health: {
    border: "border-amber-300/70",
    glow: "shadow-[0_0_22px_rgba(252,211,77,0.18)]",
    icon: "text-amber-200",
  },
  fix_center: {
    border: "border-rose-400/80",
    glow: "shadow-[0_0_26px_rgba(251,113,133,0.22)]",
    icon: "text-rose-200",
  },
};

function statusBadgeVariant(status: ModuleStatus): "secondary" | "destructive" | "outline" {
  if (status === "error") return "destructive";
  if (status === "warning") return "secondary";
  return "outline";
}

function statusLabel(status: ModuleStatus) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

function WorkflowNodeInner({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const st = groupAccent[d.group] ?? groupAccent.core_data_api;
  const dimmed = d.dimmed;

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 bg-slate-950/70 px-3 py-2.5 shadow-xl backdrop-blur-md",
        st.border,
        st.glow,
        (selected || d.selected) && "ring-2 ring-white/40",
        dimmed && "opacity-45",
      )}
      style={{ minWidth: 190, maxWidth: 260 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-sky-400/80 !bg-slate-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-sky-400/80 !bg-slate-900"
      />

      <div className="flex items-start gap-2">
        <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/5", st.icon)}>
          {d.hasChildren ? <Layers className="h-4.5 w-4.5" /> : <Link2 className="h-4.5 w-4.5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{d.title}</div>
              <div className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-300/80">
                {d.subtitle}
              </div>
            </div>
            <Badge
              variant={statusBadgeVariant(d.status)}
              className={cn(
                "shrink-0 border-white/10 bg-white/5 text-[10px] text-white/90",
                d.status === "error" && "bg-rose-500/20",
                d.status === "warning" && "bg-amber-400/15",
              )}
            >
              {statusLabel(d.status)}
            </Badge>
          </div>

          <div className="mt-2 line-clamp-2 text-xs text-zinc-300/80">{d.hint}</div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              {(d.errorCount > 0 || d.warningCount > 0) && <TriangleAlert className="h-3.5 w-3.5 text-amber-200/80" />}
              {d.errorCount > 0 && <span className="text-rose-200/90">{d.errorCount} err</span>}
              {d.warningCount > 0 && <span className="text-amber-200/90">{d.warningCount} warn</span>}
            </div>

            {d.hasChildren && (
              <div className="flex items-center gap-1 text-[10px] font-medium text-cyan-200/80">
                Drill in <ChevronRight className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeInner);

