import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Eye, EyeOff, Sparkles,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ARCH_NODES, ARCH_EDGES, LAYERS,
  type ArchNode, type ArchEdge, type ArchLayer, type Accent,
} from "@/lib/architectureGraphData";
import { ArchFlowNode, type ArchFlowNodeData } from "@/components/system-flow/ArchFlowNode";
import { applyArchitectureLayout, matchesArchitectureQuery } from "@/lib/architectureFlow";

/* ───── Style maps ───── */
const accentColor: Record<Accent, string> = {
  cyan:    "rgba(34,211,238,0.85)",
  emerald: "rgba(52,211,153,0.85)",
  orange:  "rgba(251,146,60,0.85)",
  violet:  "rgba(167,139,250,0.85)",
  blue:    "rgba(96,165,250,0.85)",
  rose:    "rgba(251,113,133,0.85)",
};

const accentBg: Record<Accent, string> = {
  cyan:    "rgba(34,211,238,0.08)",
  emerald: "rgba(52,211,153,0.08)",
  orange:  "rgba(251,146,60,0.08)",
  violet:  "rgba(167,139,250,0.08)",
  blue:    "rgba(96,165,250,0.08)",
  rose:    "rgba(251,113,133,0.08)",
};

/* ───── Edge style helpers ───── */
const FAILURE_COLOR = "rgba(251,113,133,0.85)";

function getEdgeVisuals(archEdge: ArchEdge | undefined, srcAccent: Accent) {
  const style = archEdge?.edgeStyle || "solid";
  const baseColor = style === "failure" ? FAILURE_COLOR : accentColor[srcAccent];

  const strokeDasharray = style === "dashed" ? "6 4" : style === "failure" ? "4 3" : undefined;
  const animated = style === "solid";

  return { baseColor, strokeDasharray, animated };
}

/* ───── Node types ───── */
const nodeTypes = { archNode: ArchFlowNode };

type ArchitectureFlowNode = Node<ArchFlowNodeData>;

type ArchitectureDialogNode = {
  id: string;
  hint: string;
  layer: ArchLayer;
  accent: Accent;
  icon: ArchNode["icon"];
  detail: ArchNode["detail"];
};

const getAllLayers = () => new Set(LAYERS.map((layer) => layer.key));

/* ───── Convert static data to React Flow nodes/edges ───── */
function buildInitialNodes(): ArchitectureFlowNode[] {
  return applyArchitectureLayout(
    ARCH_NODES.map((node) => ({
      id: node.id,
      type: "archNode",
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        hint: node.hint,
        accent: node.accent,
        layer: node.layer,
        detail: node.detail,
        Icon: node.icon,
      },
    })),
  );
}

function buildInitialEdges(): Edge[] {
  return ARCH_EDGES.map((e) => {
    const srcNode = ARCH_NODES.find((n) => n.id === e.source);
    const srcAccent = srcNode?.accent || "cyan";
    const { baseColor, strokeDasharray, animated } = getEdgeVisuals(e, srcAccent);

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated,
      label: e.label || undefined,
      labelStyle: e.label ? { fill: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 500 } : undefined,
      labelBgStyle: e.label ? { fill: "rgba(5,10,20,0.8)", fillOpacity: 0.9 } : undefined,
      labelBgPadding: e.label ? [4, 2] as [number, number] : undefined,
      labelBgBorderRadius: 3,
      style: {
        stroke: baseColor,
        strokeWidth: 2,
        strokeDasharray,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: baseColor,
        width: 14,
        height: 14,
      },
    };
  });
}

/* ───── Futuristic CSS injection ───── */
const FUTURISTIC_STYLES = `
@keyframes arch-scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
@keyframes arch-status-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.react-flow__edge-path {
  filter: drop-shadow(0 0 4px currentColor);
}
.react-flow__node {
  transition: transform 0.1s ease;
}
.react-flow__node:hover {
  z-index: 100 !important;
}
.react-flow__handle {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.react-flow__handle:hover {
  transform: scale(1.5);
  box-shadow: 0 0 8px rgba(34,211,238,0.6);
}
.react-flow__minimap {
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  background: rgba(5,10,20,0.8) !important;
}
.react-flow__controls {
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  background: rgba(5,10,20,0.8) !important;
}
.react-flow__controls-button {
  background: rgba(15,23,42,0.9) !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: white !important;
  fill: white !important;
}
.react-flow__controls-button:hover {
  background: rgba(30,40,60,0.9) !important;
}
.react-flow__attribution {
  display: none !important;
}
.react-flow__edgelabel-renderer .react-flow__edge-text {
  pointer-events: none;
}
`;

/* ───── Layer palette for adding new nodes ───── */
const LAYER_PALETTE: { key: ArchLayer; label: string; accent: Accent }[] = LAYERS.map((l) => ({
  key: l.key,
  label: l.label,
  accent: l.accent,
}));

/* ───── Workflow status strip pills ───── */
const WORKFLOW_STEPS = [
  { label: "Draft", color: "rgba(167,139,250,0.7)" },
  { label: "Review", color: "rgba(96,165,250,0.7)" },
  { label: "Approved", color: "rgba(52,211,153,0.7)" },
  { label: "Queued", color: "rgba(251,146,60,0.7)" },
  { label: "Processing", color: "rgba(34,211,238,0.7)" },
  { label: "Complete", color: "rgba(52,211,153,0.9)" },
];
const FAILURE_STEPS = [
  { label: "Failed", color: "rgba(251,113,133,0.8)" },
  { label: "Retry", color: "rgba(251,146,60,0.7)" },
  { label: "Dead Letter", color: "rgba(251,113,133,0.5)" },
];

export default function Architecture() {
  const [openNode, setOpenNode] = useState<ArchitectureDialogNode | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [visibleLayers, setVisibleLayers] = useState<Set<ArchLayer>>(
    getAllLayers,
  );
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeLayer, setNewNodeLayer] = useState<ArchLayer>("modules");
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<ArchitectureFlowNode, Edge> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [lockedNode, setLockedNode] = useState<string | null>(null);
  const [showAllEdges, setShowAllEdges] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<ArchitectureFlowNode>(
    buildInitialNodes(),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges());

  const handleDelete = useCallback((nodeId: string) => {
    setNodes((nds) => applyArchitectureLayout(nds.filter((n) => n.id !== nodeId)));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setOpenNode((current) => (current?.id === nodeId ? null : current));
  }, [setEdges, setNodes]);

  const handleLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, label, detail: { ...n.data.detail, title: label } } }
          : n,
      ),
    );
    setOpenNode((current) =>
      current?.id === nodeId
        ? { ...current, detail: { ...current.detail, title: label } }
        : current,
    );
  }, [setNodes]);

  useEffect(() => {
    const id = "arch-futuristic-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = FUTURISTIC_STYLES;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = nodes.find((n) => n.id === params.source);
      const color = srcNode ? accentColor[srcNode.data.accent] : accentColor.cyan;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color,
              width: 14,
              height: 14,
            },
          },
          eds,
        ),
      );
    },
    [nodes, setEdges],
  );

  const addNode = useCallback(() => {
    if (!newNodeLabel.trim()) return;
    const layer = LAYERS.find((l) => l.key === newNodeLayer)!;
    const newId = `custom-${Date.now()}`;

    const newNode: ArchitectureFlowNode = {
      id: newId,
      type: "archNode",
      position: { x: 0, y: 0 },
      data: {
        label: newNodeLabel.trim(),
        hint: layer.label,
        accent: layer.accent,
        layer: layer.key,
        detail: {
          title: newNodeLabel.trim(),
          bullets: [
            `Custom ${layer.label.toLowerCase()} component.`,
            "Added from the architecture canvas.",
            "Drag, connect, or rename it to model your flow.",
          ],
        },
        Icon: Sparkles,
        isCustom: true,
      },
    };
    setNodes((nds) => applyArchitectureLayout([...nds, newNode]));
    setNewNodeLabel("");
    setShowAddPanel(false);
  }, [newNodeLabel, newNodeLayer, setNodes]);

  const activeNode = lockedNode || hoveredNode;

  // Compute connected node IDs for the active node
  const connectedNodeIds = useMemo(() => {
    if (!activeNode) return null;
    const ids = new Set<string>();
    ids.add(activeNode);
    edges.forEach((e) => {
      if (e.source === activeNode) ids.add(e.target);
      if (e.target === activeNode) ids.add(e.source);
    });
    return ids;
  }, [activeNode, edges]);

  const onNodeClick = useCallback((_: unknown, node: ArchitectureFlowNode) => {
    // Toggle lock
    setLockedNode((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onNodeDoubleClick = useCallback((_: unknown, node: ArchitectureFlowNode) => {
    setOpenNode({
      id: node.id,
      hint: node.data.hint,
      layer: node.data.layer,
      accent: node.data.accent,
      icon: node.data.Icon,
      detail: { ...node.data.detail, title: node.data.label },
    });
  }, []);

  const onNodeMouseEnter = useCallback((_: unknown, node: ArchitectureFlowNode) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setLockedNode(null);
  }, []);

  const filteredNodeIds = useMemo(() => {
    if (!searchQ.trim()) return null;
    return new Set(
      nodes
        .filter((node) => matchesArchitectureQuery(node.data.label, node.data.hint, searchQ))
        .map((node) => node.id),
    );
  }, [nodes, searchQ]);

  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      const nodeData = n.data;
      const layerHidden = !visibleLayers.has(nodeData.layer);
      const searchHidden = filteredNodeIds ? !filteredNodeIds.has(n.id) : false;
      return {
        ...n,
        hidden: layerHidden || searchHidden,
        data: { ...nodeData, onDelete: handleDelete, onLabelChange: handleLabelChange },
      };
    });
  }, [nodes, visibleLayers, filteredNodeIds, handleDelete, handleLabelChange]);

  const displayEdges = useMemo(() => {
    const hiddenIds = new Set(displayNodes.filter((n) => n.hidden).map((n) => n.id));
    return edges.map((e) => ({
      ...e,
      hidden: hiddenIds.has(e.source) || hiddenIds.has(e.target),
    }));
  }, [edges, displayNodes]);

  const layerCounts = useMemo(() => {
    return nodes.reduce<Record<ArchLayer, number>>(
      (acc, node) => {
        acc[node.data.layer] += 1;
        return acc;
      },
      { entry: 0, auth: 0, modules: 0, ai: 0, backend: 0, external: 0, platform: 0 },
    );
  }, [nodes]);

  const visibleNodeCount = useMemo(
    () => displayNodes.filter((node) => !node.hidden).length,
    [displayNodes],
  );
  const visibleEdgeCount = useMemo(
    () => displayEdges.filter((edge) => !edge.hidden).length,
    [displayEdges],
  );

  const toggleLayer = (key: ArchLayer) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showAllLayers = useCallback(() => {
    setVisibleLayers(getAllLayers());
  }, []);

  useEffect(() => {
    if (!reactFlowInstance || !visibleNodeCount) return;

    const timeoutId = window.setTimeout(() => {
      reactFlowInstance.fitView({
        padding: 0.18,
        duration: 250,
        includeHiddenNodes: false,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [reactFlowInstance, visibleNodeCount, visibleEdgeCount]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">System Architecture</h1>
          <p className="text-xs text-muted-foreground">
            {visibleNodeCount} of {nodes.length} components · {visibleEdgeCount} of {edges.length} connections · Drag to move · Connect handles to wire · Double-click to edit
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setShowAddPanel(!showAddPanel)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Node
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Filter nodes…"
            className="h-8 w-48 rounded-md border border-border bg-secondary pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQ && (
            <button type="button" onClick={() => setSearchQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      <div className="flex shrink-0 flex-col gap-2 border-b border-border/40 bg-background/70 px-4 py-3 md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LAYERS.map((layer) => {
            const on = visibleLayers.has(layer.key);
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => toggleLayer(layer.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  on
                    ? "border-border bg-secondary text-foreground"
                    : "border-border/60 bg-background text-muted-foreground",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: accentColor[layer.accent] }}
                />
                {layer.label}
                <span className="text-[10px] text-muted-foreground">{layerCounts[layer.key]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={showAllLayers}
            className="inline-flex shrink-0 items-center rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
          >
            Show all
          </button>
        </div>

        {showAddPanel && (
          <div className="grid gap-2 rounded-xl border border-border/60 bg-background/70 p-3">
            <input
              type="text"
              value={newNodeLabel}
              onChange={(e) => setNewNodeLabel(e.target.value)}
              placeholder="Node name…"
              className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => e.key === "Enter" && addNode()}
            />
            <select
              value={newNodeLayer}
              onChange={(e) => setNewNodeLayer(e.target.value as ArchLayer)}
              className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none"
            >
              {LAYER_PALETTE.map((layer) => (
                <option key={layer.key} value={layer.key}>{layer.label}</option>
              ))}
            </select>
            <Button size="sm" className="justify-center" onClick={addNode}>
              Add node
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Layer filter sidebar */}
        <div className="hidden md:flex w-44 shrink-0 flex-col border-r border-border/40 bg-background/60 backdrop-blur-sm p-3 gap-1.5 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Layers</p>
          {LAYERS.map((layer) => {
            const on = visibleLayers.has(layer.key);
            const count = layerCounts[layer.key];
            return (
              <button
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                  on ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50",
                )}
              >
                {on ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: accentColor[layer.accent] }}
                />
                <span className="flex-1 truncate">{layer.label}</span>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}

          {/* Workflow status strip */}
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Workflow</p>
            <div className="flex flex-wrap gap-1 items-center">
              {WORKFLOW_STEPS.map((s, i) => (
                <span key={s.label} className="flex items-center gap-0.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                    style={{ background: s.color, color: "white" }}
                  >
                    {s.label}
                  </span>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <span className="text-[8px] text-muted-foreground">→</span>
                  )}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 items-center mt-1.5">
              {FAILURE_STEPS.map((s, i) => (
                <span key={s.label} className="flex items-center gap-0.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                    style={{ background: s.color, color: "white" }}
                  >
                    {s.label}
                  </span>
                  {i < FAILURE_STEPS.length - 1 && (
                    <span className="text-[8px] text-muted-foreground">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {showAddPanel && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">New Node</p>
              <input
                type="text"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder="Node name…"
                className="w-full h-7 rounded-md border border-border bg-secondary px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                onKeyDown={(e) => e.key === "Enter" && addNode()}
              />
              <select
                value={newNodeLayer}
                onChange={(e) => setNewNodeLayer(e.target.value as ArchLayer)}
                className="w-full h-7 rounded-md border border-border bg-secondary px-2 text-xs text-foreground outline-none"
              >
                {LAYER_PALETTE.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
              <Button size="sm" className="w-full text-xs h-7" onClick={addNode}>
                Add
              </Button>
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-border/40">
            <button
              onClick={showAllLayers}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Show all
            </button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            deleteKeyCode={["Backspace", "Delete"]}
            snapToGrid
            snapGrid={[10, 10]}
            style={{
              background: "radial-gradient(ellipse at center, #0c2140 0%, #050a14 55%, #020617 100%)",
            }}
            defaultEdgeOptions={{
              animated: true,
              style: { strokeWidth: 2 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(34,211,238,0.08)"
            />
            <Controls position="top-right" />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const accent = (n.data as ArchFlowNodeData | undefined)?.accent;
                return accent ? accentColor[accent] : "rgba(100,100,100,0.5)";
              }}
              maskColor="rgba(0,0,0,0.7)"
              style={{ width: 160, height: 100 }}
            />
          </ReactFlow>

          {!visibleNodeCount && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-950/80 px-5 py-4 text-center backdrop-blur-md">
                <p className="text-sm font-semibold text-white">No matching components</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Clear the search or re-enable layers to bring the architecture back into view.
                </p>
              </div>
            </div>
          )}

          {/* Scan-line overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.012) 2px, rgba(34,211,238,0.012) 4px)",
            }}
          />

          {/* Bottom info bar */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur-sm">
              Drag nodes · Draw edges · Delete with ⌫ · Double-click to rename
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 backdrop-blur-sm">
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                style={{ animation: "arch-status-blink 2s ease-in-out infinite" }}
              />
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/80">
                System Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <AnimatePresence>
        {openNode && (
          <Dialog open={!!openNode} onOpenChange={(o) => !o && setOpenNode(null)}>
            <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <openNode.icon className="h-5 w-5" style={{ color: accentColor[openNode.accent] }} />
                  {openNode.detail.title}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: accentBg[openNode.accent],
                          color: accentColor[openNode.accent],
                          border: `1px solid ${accentColor[openNode.accent]}`,
                        }}
                      >
                        {openNode.layer}
                      </span>
                      <span className="text-muted-foreground">{openNode.hint}</span>
                    </div>
                    <ul className="list-inside list-disc space-y-1.5 text-left text-sm text-muted-foreground">
                      {openNode.detail.bullets.map((line) => (
                        <li key={line} className="break-words">{line}</li>
                      ))}
                    </ul>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Connected to</p>
                      <div className="flex flex-wrap gap-1.5">
                        {edges
                          .filter((e) => e.source === openNode.id || e.target === openNode.id)
                          .map((e) => {
                            const otherId = e.source === openNode.id ? e.target : e.source;
                            const other = nodes.find((n) => n.id === otherId);
                            if (!other) return null;
                            return (
                              <button
                                key={e.id}
                                onClick={() => {
                                  const next = nodes.find((n) => n.id === otherId);
                                  if (!next) return;
                                  setOpenNode({
                                    id: next.id,
                                    hint: next.data.hint,
                                    layer: next.data.layer,
                                    accent: next.data.accent,
                                    icon: next.data.Icon,
                                    detail: { ...next.data.detail, title: next.data.label },
                                  });
                                }}
                                className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80"
                                style={{
                                  background: accentBg[other.data.accent],
                                  color: accentColor[other.data.accent],
                                  border: `1px solid ${accentColor[other.data.accent]}40`,
                                }}
                              >
                                {other.data.label}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
