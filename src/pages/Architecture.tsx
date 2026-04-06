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
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
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
  type ArchNode, type ArchLayer, type Accent,
} from "@/lib/architectureGraphData";
import { ArchFlowNode } from "@/components/system-flow/ArchFlowNode";

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

/* ───── Node types ───── */
const nodeTypes = { archNode: ArchFlowNode };

/* ───── Layout constants ───── */
const LAYER_GAP = 180;
const NODE_W = 130;
const NODE_GAP = 20;
const LEFT_MARGIN = 180;
const TOP_MARGIN = 60;

/* ───── Convert static data to React Flow nodes/edges ───── */
function buildInitialNodes(
  onDelete: (id: string) => void,
  onLabelChange: (id: string, label: string) => void,
): Node[] {
  const nodes: Node[] = [];
  let layerIdx = 0;

  for (const layer of LAYERS) {
    const layerNodes = ARCH_NODES.filter((n) => n.layer === layer.key);
    const totalW = layerNodes.length * NODE_W + (layerNodes.length - 1) * NODE_GAP;
    const startX = LEFT_MARGIN + Math.max(0, (900 - totalW) / 2);
    const y = TOP_MARGIN + layerIdx * LAYER_GAP;

    layerNodes.forEach((n, i) => {
      nodes.push({
        id: n.id,
        type: "archNode",
        position: { x: startX + i * (NODE_W + NODE_GAP), y },
        data: {
          label: n.label,
          hint: n.hint,
          accent: n.accent,
          Icon: n.icon,
          onDelete,
          onLabelChange,
        },
      });
    });
    layerIdx++;
  }
  return nodes;
}

function buildInitialEdges(): Edge[] {
  return ARCH_EDGES.map((e) => {
    const srcNode = ARCH_NODES.find((n) => n.id === e.source);
    const color = srcNode ? accentColor[srcNode.accent] : accentColor.cyan;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
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
`;

/* ───── Layer palette for adding new nodes ───── */
const LAYER_PALETTE: { key: ArchLayer; label: string; accent: Accent }[] = LAYERS.map((l) => ({
  key: l.key,
  label: l.label,
  accent: l.accent,
}));

export default function Architecture() {
  const [openNode, setOpenNode] = useState<ArchNode | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [visibleLayers, setVisibleLayers] = useState<Set<ArchLayer>>(
    () => new Set(LAYERS.map((l) => l.key)),
  );
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeLayer, setNewNodeLayer] = useState<ArchLayer>("modules");

  /* Delete + label change handlers (stable via useCallback) */
  const handleDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const handleLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
      ),
    );
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    buildInitialNodes(handleDelete, handleLabelChange),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges());

  /* Inject futuristic styles */
  useEffect(() => {
    const id = "arch-futuristic-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = FUTURISTIC_STYLES;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  /* Connect handler — draw new edges */
  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = nodes.find((n) => n.id === params.source);
      const color = srcNode ? accentColor[(srcNode.data as any).accent] : accentColor.cyan;
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

  /* Add new node */
  const addNode = useCallback(() => {
    if (!newNodeLabel.trim()) return;
    const layer = LAYERS.find((l) => l.key === newNodeLayer)!;
    const layerIdx = LAYERS.findIndex((l) => l.key === newNodeLayer);
    const newId = `custom-${Date.now()}`;
    const y = TOP_MARGIN + layerIdx * LAYER_GAP;
    const existingInLayer = nodes.filter((n) => (n.data as any).accent === layer.accent);
    const x = LEFT_MARGIN + existingInLayer.length * (NODE_W + NODE_GAP);

    const newNode: Node = {
      id: newId,
      type: "archNode",
      position: { x, y },
      data: {
        label: newNodeLabel.trim(),
        hint: layer.label,
        accent: layer.accent,
        Icon: Sparkles,
        onDelete: handleDelete,
        onLabelChange: handleLabelChange,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setNewNodeLabel("");
    setShowAddPanel(false);
  }, [newNodeLabel, newNodeLayer, nodes, handleDelete, handleLabelChange, setNodes]);

  /* Node click → detail */
  const onNodeClick = useCallback((_: any, node: Node) => {
    const archNode = ARCH_NODES.find((n) => n.id === node.id);
    if (archNode) setOpenNode(archNode);
  }, []);

  /* Search-filtered nodes */
  const filteredNodeIds = useMemo(() => {
    if (!searchQ.trim()) return null;
    const q = searchQ.toLowerCase();
    return new Set(
      ARCH_NODES.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.hint.toLowerCase().includes(q),
      ).map((n) => n.id),
    );
  }, [searchQ]);

  /* Apply visibility */
  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      const nodeData = n.data as any;
      const layerKey = ARCH_NODES.find((an) => an.id === n.id)?.layer;
      const layerHidden = layerKey ? !visibleLayers.has(layerKey) : false;
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

  const toggleLayer = (key: ArchLayer) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">System Architecture</h1>
          <p className="text-xs text-muted-foreground">
            {nodes.length} components · {edges.length} connections · Drag to move · Connect handles to wire · Double-click to edit
          </p>
        </div>

        {/* Add node button */}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setShowAddPanel(!showAddPanel)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Node
        </Button>

        {/* Search */}
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
            <button onClick={() => setSearchQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Layer filter sidebar */}
        <div className="hidden md:flex w-44 shrink-0 flex-col border-r border-border/40 bg-background/60 backdrop-blur-sm p-3 gap-1.5 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Layers</p>
          {LAYERS.map((layer) => {
            const on = visibleLayers.has(layer.key);
            const count = ARCH_NODES.filter((n) => n.layer === layer.key).length;
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

          {/* Add node panel (inline) */}
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
              onClick={() => setVisibleLayers(new Set(LAYERS.map((l) => l.key)))}
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
                const accent = (n.data as any)?.accent as string;
                return accentColor[accent as Accent] || "rgba(100,100,100,0.5)";
              }}
              maskColor="rgba(0,0,0,0.7)"
              style={{ width: 160, height: 100 }}
            />
          </ReactFlow>

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
                    {/* Connected nodes */}
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Connected to</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ARCH_EDGES
                          .filter((e) => e.source === openNode.id || e.target === openNode.id)
                          .map((e) => {
                            const otherId = e.source === openNode.id ? e.target : e.source;
                            const other = ARCH_NODES.find((n) => n.id === otherId);
                            if (!other) return null;
                            return (
                              <button
                                key={e.id}
                                onClick={() => {
                                  const next = ARCH_NODES.find((n) => n.id === otherId);
                                  if (next) setOpenNode(next);
                                }}
                                className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80"
                                style={{
                                  background: accentBg[other.accent],
                                  color: accentColor[other.accent],
                                  border: `1px solid ${accentColor[other.accent]}40`,
                                }}
                              >
                                {other.label}
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
