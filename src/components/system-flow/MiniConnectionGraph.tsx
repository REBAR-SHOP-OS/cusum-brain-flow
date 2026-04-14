import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";

const accentStyles: Record<string, { bg: string; border: string; text: string }> = {
  cyan:    { bg: "rgba(34,211,238,0.15)", border: "rgba(34,211,238,0.7)", text: "rgb(34,211,238)" },
  emerald: { bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.7)", text: "rgb(52,211,153)" },
  violet:  { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.7)", text: "rgb(167,139,250)" },
  orange:  { bg: "rgba(251,146,60,0.15)", border: "rgba(251,146,60,0.7)", text: "rgb(251,146,60)" },
  blue:    { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.7)", text: "rgb(96,165,250)" },
  rose:    { bg: "rgba(251,113,133,0.15)", border: "rgba(251,113,133,0.7)", text: "rgb(251,113,133)" },
};

function MiniNode({ data }: { data: Record<string, unknown> }) {
  const label = data.label as string;
  const accent = (data.accent as string) || "cyan";
  const isCenter = data.isCenter as boolean;
  const st = accentStyles[accent] || accentStyles.cyan;

  return (
    <div
      style={{
        background: isCenter ? st.border : st.bg,
        border: `1.5px solid ${st.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 10,
        fontWeight: 600,
        color: isCenter ? "#0a0e1a" : st.text,
        maxWidth: 120,
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxShadow: isCenter ? `0 0 16px ${st.border}` : "none",
      }}
    >
      {label}
    </div>
  );
}

const miniNodeTypes = { miniNode: MiniNode };

type Props = {
  selectedNodeId: string;
  allNodes: Node[];
  allEdges: Edge[];
};

function MiniGraphInner({ selectedNodeId, allNodes, allEdges }: Props) {
  const { fitView } = useReactFlow();

  const { miniNodes, miniEdges } = useMemo(() => {
    const connectedEdges = allEdges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );

    const neighborIds = new Set<string>();
    connectedEdges.forEach((e) => {
      neighborIds.add(e.source === selectedNodeId ? e.target : e.source);
    });

    const centerNode = allNodes.find((n) => n.id === selectedNodeId);
    if (!centerNode) return { miniNodes: [], miniEdges: [] };

    const neighbors = allNodes.filter((n) => neighborIds.has(n.id));
    const total = neighbors.length;
    const radius = Math.max(120, total * 18);
    const cx = 200;
    const cy = 180;

    const mNodes: Node[] = [
      {
        id: centerNode.id,
        type: "miniNode",
        position: { x: cx - 50, y: cy - 15 },
        data: {
          label: centerNode.data.label,
          accent: centerNode.data.accent,
          isCenter: true,
        },
        draggable: false,
      },
      ...neighbors.map((n, i) => {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        return {
          id: n.id,
          type: "miniNode" as const,
          position: {
            x: cx - 50 + radius * Math.cos(angle),
            y: cy - 15 + radius * Math.sin(angle),
          },
          data: {
            label: n.data.label,
            accent: n.data.accent,
            isCenter: false,
          },
          draggable: false,
        };
      }),
    ];

    const mEdges: Edge[] = connectedEdges.map((e) => ({
      id: `mini-${e.id}`,
      source: e.source,
      target: e.target,
      style: { stroke: "rgba(148,163,184,0.4)", strokeWidth: 1.5 },
      animated: false,
    }));

    return { miniNodes: mNodes, miniEdges: mEdges };
  }, [selectedNodeId, allNodes, allEdges]);

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
  }, [fitView]);

  if (!miniNodes.length) return null;

  return (
    <div style={{ width: "100%", height: 300, borderRadius: 8, overflow: "hidden", background: "rgba(8,12,30,0.6)", border: "1px solid rgba(148,163,184,0.15)" }}>
      <ReactFlow
        nodes={miniNodes}
        edges={miniEdges}
        nodeTypes={miniNodeTypes}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
      />
    </div>
  );
}

export default function MiniConnectionGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <MiniGraphInner {...props} />
    </ReactFlowProvider>
  );
}
