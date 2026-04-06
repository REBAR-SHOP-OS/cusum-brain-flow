import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./workflow-diagram.css";
import { cn } from "@/lib/utils";
import { WorkflowNode } from "@/components/system-workflow/WorkflowNode";
import { ConnectionEdge } from "@/components/system-workflow/ConnectionEdge";

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { connectionEdge: ConnectionEdge };

export type DiagramCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onPaneClick: () => void;
  className?: string;
};

export function DiagramCanvas(props: DiagramCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onNodeDoubleClick, onPaneClick, className } = props;
  const ignoreNextPaneClickRef = useRef(false);

  const miniMapNodeColor = useCallback((n: Node) => {
    const s = (n.data as any)?.status;
    if (s === "error") return "#fb7185";
    if (s === "warning") return "#fbbf24";
    if (s === "healthy") return "#34d399";
    return "#60a5fa";
  }, []);

  const fitViewOptions = useMemo(() => ({ padding: 0.18, includeHiddenNodes: false }), []);

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0c2140_0%,_#050a14_55%,_#020617_100%)]",
        className,
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={() => {
          if (ignoreNextPaneClickRef.current) {
            ignoreNextPaneClickRef.current = false;
            return;
          }
          onPaneClick();
        }}
        onNodeClick={(_, node) => {
          ignoreNextPaneClickRef.current = true;
          onNodeClick(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          ignoreNextPaneClickRef.current = true;
          onNodeDoubleClick(node.id);
        }}
        fitView
        fitViewOptions={fitViewOptions}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        selectionOnDrag
      >
        <Background color="rgba(148,163,184,0.18)" gap={22} size={1} />
        <Controls
          className="!rounded-xl !border !border-white/10 !bg-slate-950/70 !shadow-lg !backdrop-blur-md"
          showInteractive={false}
        />
        <MiniMap
          className="!rounded-xl !border !border-white/10 !bg-slate-950/60 !shadow-lg !backdrop-blur-md"
          nodeColor={miniMapNodeColor}
          maskColor="rgba(2, 6, 23, 0.55)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

