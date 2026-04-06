import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { FlowEdgeKind } from "@/types/workflowDiagram";

const kindColor: Record<FlowEdgeKind, { stroke: string; glow: string }> = {
  data: { stroke: "rgba(56,189,248,0.85)", glow: "rgba(56,189,248,0.35)" },
  event: { stroke: "rgba(96,165,250,0.85)", glow: "rgba(96,165,250,0.35)" },
  api: { stroke: "rgba(167,139,250,0.9)", glow: "rgba(167,139,250,0.4)" },
  webhook: { stroke: "rgba(52,211,153,0.85)", glow: "rgba(52,211,153,0.35)" },
  user_action: { stroke: "rgba(251,191,36,0.9)", glow: "rgba(251,191,36,0.35)" },
  job: { stroke: "rgba(248,113,113,0.9)", glow: "rgba(248,113,113,0.35)" },
};

export type ConnectionEdgeData = {
  kind: FlowEdgeKind;
  label?: string;
  dimmed?: boolean;
};

export function ConnectionEdge(props: EdgeProps) {
  const data = (props.data ?? {}) as Partial<ConnectionEdgeData>;
  const kind = data.kind ?? "data";
  const { stroke, glow } = kindColor[kind];
  const [edgePath] = getBezierPath(props);

  const opacity = data.dimmed ? 0.22 : 0.92;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: glow,
          strokeWidth: 8,
          filter: "blur(6px)",
          opacity: Math.min(opacity, 0.5),
        }}
      />
      <BaseEdge
        path={edgePath}
        className="swf-edge swf-edge--animated"
        style={{
          stroke,
          strokeWidth: 2.6,
          strokeLinecap: "round",
          opacity,
        }}
      />
    </>
  );
}

