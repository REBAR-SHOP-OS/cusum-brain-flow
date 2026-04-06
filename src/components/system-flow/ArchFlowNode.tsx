import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Accent, ArchLayer } from "@/lib/architectureGraphData";

export type ArchFlowNodeData = {
  label: string;
  hint: string;
  accent: Accent;
  large?: boolean;
  layer: ArchLayer;
  pinned: boolean;
  Icon: LucideIcon;
  onTogglePin: (id: string) => void;
};

const accentStyles: Record<Accent, { border: string; glow: string; icon: string }> = {
  cyan: {
    border: "border-cyan-400/90",
    glow: "shadow-[0_0_18px_rgba(34,211,238,0.35)]",
    icon: "text-cyan-200",
  },
  emerald: {
    border: "border-emerald-400/90",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.35)]",
    icon: "text-emerald-200",
  },
  violet: {
    border: "border-violet-400/90",
    glow: "shadow-[0_0_20px_rgba(167,139,250,0.4)]",
    icon: "text-violet-200",
  },
  orange: {
    border: "border-orange-400",
    glow: "shadow-[0_0_28px_rgba(251,146,60,0.5)]",
    icon: "text-orange-100",
  },
};

function ArchFlowNodeInner({ id, data, selected }: NodeProps<ArchFlowNodeData>) {
  const st = accentStyles[data.accent];
  const isLarge = !!data.large;

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 bg-slate-950/80 px-3 py-2.5 text-center shadow-xl backdrop-blur-md",
        st.border,
        st.glow,
        selected && "ring-2 ring-white/40",
        data.pinned && "ring-2 ring-amber-400/70",
      )}
      style={{ minWidth: isLarge ? 168 : 138, maxWidth: isLarge ? 200 : 160 }}
    >
      {data.layer !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-sky-400/80 !bg-slate-900"
        />
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onTogglePin(id);
        }}
        className={cn(
          "absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-slate-900/90 text-white/80 transition hover:bg-slate-800 hover:text-white",
          data.pinned && "border-amber-400/60 text-amber-200",
        )}
        title={data.pinned ? "Unpin (allow drag)" : "Pin (lock position)"}
      >
        {data.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
      </button>

      <data.Icon
        className={cn(
          "mx-auto mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]",
          isLarge ? "h-10 w-10" : "h-8 w-8",
          st.icon,
        )}
        strokeWidth={1.35}
      />

      <div className={cn("mx-auto font-semibold text-white", isLarge ? "text-sm" : "text-xs")}>
        {data.label}
      </div>
      <div className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">{data.hint}</div>

      {data.layer !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-sky-400/80 !bg-slate-900"
        />
      )}
    </div>
  );
}

export const ArchFlowNode = memo(ArchFlowNodeInner);
