import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ArchLayer, ArchNode } from "@/lib/architectureGraphData";

export type FlowAccent = "cyan" | "emerald" | "violet" | "orange" | "blue" | "rose" | "amber";

export type ArchFlowNodeData = {
  label: string;
  hint: string;
  accent: FlowAccent;
  layer: ArchLayer;
  Icon: LucideIcon;
  detail: ArchNode["detail"];
  isCustom?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  onDelete?: (id: string) => void;
  onLabelChange?: (id: string, label: string) => void;
  onExplain?: (id: string) => void;
};

const accentStyles: Record<FlowAccent, { border: string; glow: string; solid: string; bg: string }> = {
  cyan: {
    border: "rgb(34,211,238)",
    glow: "0 0 18px rgba(34,211,238,0.35)",
    solid: "rgb(34,211,238)",
    bg: "rgb(15,50,60)",
  },
  emerald: {
    border: "rgb(52,211,153)",
    glow: "0 0 18px rgba(52,211,153,0.35)",
    solid: "rgb(52,211,153)",
    bg: "rgb(18,55,40)",
  },
  violet: {
    border: "rgb(167,139,250)",
    glow: "0 0 20px rgba(167,139,250,0.4)",
    solid: "rgb(167,139,250)",
    bg: "rgb(40,30,65)",
  },
  orange: {
    border: "rgb(251,146,60)",
    glow: "0 0 22px rgba(251,146,60,0.45)",
    solid: "rgb(251,146,60)",
    bg: "rgb(60,38,18)",
  },
  blue: {
    border: "rgb(96,165,250)",
    glow: "0 0 18px rgba(96,165,250,0.35)",
    solid: "rgb(96,165,250)",
    bg: "rgb(22,38,65)",
  },
  rose: {
    border: "rgb(251,113,133)",
    glow: "0 0 18px rgba(251,113,133,0.35)",
    solid: "rgb(251,113,133)",
    bg: "rgb(60,25,35)",
  },
  amber: {
    border: "rgb(245,195,68)",
    glow: "0 0 18px rgba(245,195,68,0.35)",
    solid: "rgb(245,195,68)",
    bg: "rgb(55,42,15)",
  },
};

function ArchFlowNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ArchFlowNodeData;
  const st = accentStyles[nodeData.accent] || accentStyles.cyan;
  const Icon = nodeData.Icon;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(nodeData.label);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editVal.trim() && editVal !== nodeData.label) {
      nodeData.onLabelChange?.(id, editVal.trim());
    } else {
      setEditVal(nodeData.label);
    }
  }, [editVal, nodeData, id]);

  return (
    <div
      className={cn(
        "group relative rounded-xl text-center transition-all duration-200",
        selected && "ring-2 ring-white/40",
        nodeData.dimmed && "pointer-events-none",
      )}
      style={{
        width: 190,
        minHeight: 120,
        border: `1.5px solid ${st.border}`,
        borderLeft: `3px solid ${st.solid}`,
        boxShadow: nodeData.highlighted
          ? `${st.glow}, 0 0 24px ${st.solid}60, 0 0 0 2px ${st.solid}40`
          : selected
            ? `${st.glow}, 0 0 0 2px rgba(255,255,255,0.15)`
            : st.glow,
        background: st.bg,
        padding: "10px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: nodeData.dimmed ? 0.15 : 1,
        transition: "opacity 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {/* Top glow line */}
      <div
        className="absolute top-0 left-2 right-2 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${st.solid}, transparent)`, opacity: 0.6 }}
      />

      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !bg-slate-900"
        style={{ borderColor: st.border }}
      />

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onDelete?.(id);
        }}
        className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-slate-900/90 text-white/60 transition hover:bg-red-900/80 hover:text-red-300 opacity-0 group-hover:opacity-100"
        style={{ opacity: selected ? 1 : undefined }}
        title="Delete node"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>

      {Icon && (
        <Icon
          className="shrink-0 mb-1"
          style={{ color: st.border, width: 26, height: 26, filter: `drop-shadow(0 0 6px ${st.solid}40)` }}
          strokeWidth={1.5}
        />
      )}

      {editing ? (
        <input
          autoFocus
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") { setEditVal(nodeData.label); setEditing(false); }
          }}
          className="w-full bg-transparent text-center text-[13px] font-semibold text-white outline-none border-b border-white/30"
          style={{ maxWidth: 140 }}
        />
      ) : (
        <span
          className="max-w-[140px] cursor-text text-balance text-[13px] font-semibold leading-tight text-white"
          onDoubleClick={() => { setEditVal(nodeData.label); setEditing(true); }}
          title={nodeData.label}
        >
          {nodeData.label}
        </span>
      )}

      <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: st.border, opacity: 0.7 }}>
        {nodeData.hint}
      </span>

      {nodeData.detail?.bullets?.[0] && (
        <span
          className="mt-0.5 max-w-[160px] text-[10px] leading-tight text-white/50"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={nodeData.detail.bullets[0]}
        >
          {nodeData.detail.bullets[0]}
        </span>
      )}

      {/* Explain button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onExplain?.(id);
        }}
        className="absolute -bottom-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-slate-900/90 text-white/60 transition hover:text-white opacity-0 group-hover:opacity-100"
        style={{ opacity: selected ? 1 : undefined, borderColor: `${st.solid}60` }}
        title="Explain node"
      >
        <Info className="h-2.5 w-2.5" style={{ color: st.solid }} />
      </button>

      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !bg-slate-900"
        style={{ borderColor: st.border }}
      />
    </div>
  );
}

export const ArchFlowNode = memo(ArchFlowNodeInner);
