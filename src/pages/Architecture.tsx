import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn, ZoomOut, Maximize2, Move, Search, Eye, EyeOff, X,
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

/* ───── Style maps ───── */
const accentColor: Record<Accent, string> = {
  cyan:    "rgba(34,211,238,0.85)",
  emerald: "rgba(52,211,153,0.85)",
  orange:  "rgba(251,146,60,0.85)",
  violet:  "rgba(167,139,250,0.85)",
  blue:    "rgba(96,165,250,0.85)",
  rose:    "rgba(251,113,133,0.85)",
};

const accentGlow: Record<Accent, string> = {
  cyan:    "0 0 18px rgba(34,211,238,0.35)",
  emerald: "0 0 18px rgba(52,211,153,0.35)",
  orange:  "0 0 22px rgba(251,146,60,0.45)",
  violet:  "0 0 20px rgba(167,139,250,0.4)",
  blue:    "0 0 18px rgba(96,165,250,0.35)",
  rose:    "0 0 18px rgba(251,113,133,0.35)",
};

const accentBg: Record<Accent, string> = {
  cyan:    "rgba(34,211,238,0.08)",
  emerald: "rgba(52,211,153,0.08)",
  orange:  "rgba(251,146,60,0.08)",
  violet:  "rgba(167,139,250,0.08)",
  blue:    "rgba(96,165,250,0.08)",
  rose:    "rgba(251,113,133,0.08)",
};

/* ───── Layout constants ───── */
const LAYER_GAP = 170;
const NODE_W = 120;
const NODE_H = 72;
const NODE_GAP = 18;
const LEFT_MARGIN = 160;
const TOP_MARGIN = 60;

function computeNodePositions(
  visibleLayers: Set<ArchLayer>,
  filteredIds: Set<string> | null,
) {
  const positions = new Map<string, { x: number; y: number }>();
  let layerIdx = 0;

  for (const layer of LAYERS) {
    if (!visibleLayers.has(layer.key)) continue;
    const nodes = ARCH_NODES.filter(
      (n) => n.layer === layer.key && (!filteredIds || filteredIds.has(n.id)),
    );
    const totalW = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
    const startX = LEFT_MARGIN + Math.max(0, (900 - totalW) / 2);
    const y = TOP_MARGIN + layerIdx * LAYER_GAP;

    nodes.forEach((n, i) => {
      positions.set(n.id, { x: startX + i * (NODE_W + NODE_GAP), y });
    });
    layerIdx++;
  }
  return positions;
}

/* ───── Canvas size ───── */
const CANVAS_W = 1200;
const CANVAS_H = 1100;

/* ───── Edge path with vertical Bezier ───── */
function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const cy1 = y1 + 50;
  const cy2 = y2 - 50;
  return `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;
}

export default function Architecture() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [visibleLayers, setVisibleLayers] = useState<Set<ArchLayer>>(
    () => new Set(LAYERS.map((l) => l.key)),
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const draggingRef = useRef(false);
  const dragRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  /* search filter */
  const filteredIds = useMemo(() => {
    if (!searchQ.trim()) return null;
    const q = searchQ.toLowerCase();
    const ids = new Set<string>();
    ARCH_NODES.forEach((n) => {
      if (
        n.label.toLowerCase().includes(q) ||
        n.hint.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
      )
        ids.add(n.id);
    });
    return ids;
  }, [searchQ]);

  /* positions */
  const positions = useMemo(
    () => computeNodePositions(visibleLayers, filteredIds),
    [visibleLayers, filteredIds],
  );

  /* visible edges */
  const visibleEdges = useMemo(() => {
    return ARCH_EDGES.filter(
      (e) => positions.has(e.source) && positions.has(e.target),
    );
  }, [positions]);

  /* zoom via wheel */
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(2.5, Math.max(0.35, prev - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  /* pan */
  const onPanPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    dragRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
  };
  const onPanPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const d = dragRef.current;
    setPan({ x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) });
  };
  const onPanPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const resetView = () => { setPan({ x: 0, y: 0 }); setZoom(0.85); };

  const toggleLayer = (key: ArchLayer) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selected = openId ? ARCH_NODES.find((n) => n.id === openId) : null;
  const SelectedIcon = selected?.icon;

  /* visible nodes */
  const visibleNodes = ARCH_NODES.filter(
    (n) => visibleLayers.has(n.layer) && (!filteredIds || filteredIds.has(n.id)),
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">System Architecture</h1>
          <p className="text-xs text-muted-foreground">
            {ARCH_NODES.length} components · {ARCH_EDGES.length} connections · {LAYERS.length} layers
          </p>
        </div>

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

          <div className="mt-auto pt-3 border-t border-border/40">
            <button
              onClick={() => setVisibleLayers(new Set(LAYERS.map((l) => l.key)))}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Show all
            </button>
          </div>
        </div>

        {/* Canvas viewport */}
        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at center, #0c2140 0%, #050a14 55%, #020617 100%)",
          }}
        >
          {/* Zoom controls */}
          <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-slate-950/70 p-1.5 shadow-lg backdrop-blur-md">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={resetView} aria-label="Reset view">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center border-t border-white/10 pt-1">
              <Move className="h-3.5 w-3.5 text-white/50" />
            </div>
            <span className="text-center text-[9px] text-white/40">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Pan surface */}
          <motion.div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={onPanPointerDown}
            onPointerMove={onPanPointerMove}
            onPointerUp={onPanPointerUp}
            onPointerLeave={() => { draggingRef.current = false; }}
          >
            <motion.div
              className="relative will-change-transform origin-top-left"
              style={{ width: CANVAS_W, height: CANVAS_H, x: pan.x, y: pan.y, scale: zoom }}
            >
              {/* Layer labels */}
              {(() => {
                let idx = 0;
                return LAYERS.map((layer) => {
                  if (!visibleLayers.has(layer.key)) return null;
                  const y = TOP_MARGIN + idx * LAYER_GAP;
                  idx++;
                  return (
                    <div
                      key={layer.key}
                      className="absolute left-2 flex items-center gap-2 select-none"
                      style={{ top: y + NODE_H / 2 - 10 }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: accentColor[layer.accent] }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.15em]"
                        style={{ color: accentColor[layer.accent], opacity: 0.7 }}
                      >
                        {layer.label}
                      </span>
                    </div>
                  );
                });
              })()}

              {/* SVG edges */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <filter id="edgeGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {LAYERS.map((l) => (
                    <linearGradient key={l.key} id={`grad-${l.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={accentColor[l.accent]} stopOpacity="0.7" />
                      <stop offset="50%" stopColor={accentColor[l.accent]} stopOpacity="1.0" />
                      <stop offset="100%" stopColor={accentColor[l.accent]} stopOpacity="0.7" />
                    </linearGradient>
                  ))}
                </defs>

                {visibleEdges.map((edge) => {
                  const sp = positions.get(edge.source)!;
                  const tp = positions.get(edge.target)!;
                  const srcNode = ARCH_NODES.find((n) => n.id === edge.source);
                  const srcLayer = srcNode?.layer || "entry";
                  const isHighlighted = hoverId === edge.source || hoverId === edge.target;

                  const x1 = sp.x + NODE_W / 2;
                  const y1 = sp.y + NODE_H;
                  const x2 = tp.x + NODE_W / 2;
                  const y2 = tp.y;

                  return (
                    <g key={edge.id}>
                      <path
                        d={edgePath(x1, y1, x2, y2)}
                        fill="none"
                        stroke={`url(#grad-${srcLayer})`}
                        strokeWidth={isHighlighted ? 2.5 : 2}
                        strokeLinecap="round"
                        filter="url(#edgeGlow)"
                        opacity={isHighlighted ? 1 : 0.7}
                        className="transition-all duration-300"
                      />
                      {/* Animated particle */}
                      <circle r="2.5" fill={accentColor[srcNode?.accent || "cyan"]} opacity="0.9">
                        <animateMotion
                          dur={`${2 + Math.random() * 2}s`}
                          repeatCount="indefinite"
                          path={edgePath(x1, y1, x2, y2)}
                        />
                      </circle>
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {visibleNodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                const isHover = hoverId === node.id;
                const Icon = node.icon;

                return (
                  <motion.button
                    key={node.id}
                    type="button"
                    className="absolute flex flex-col items-center justify-center rounded-xl text-center backdrop-blur-md"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: NODE_W,
                      height: NODE_H,
                      zIndex: isHover ? 20 : 10,
                      border: `1.5px solid ${accentColor[node.accent]}`,
                      boxShadow: isHover
                        ? `${accentGlow[node.accent]}, 0 0 0 2px rgba(255,255,255,0.15)`
                        : accentGlow[node.accent],
                      background: isHover
                        ? `linear-gradient(135deg, ${accentBg[node.accent]}, rgba(15,23,42,0.85))`
                        : "rgba(15,23,42,0.7)",
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: isHover ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setOpenId(node.id)}
                    onMouseEnter={() => setHoverId(node.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <Icon
                      className="shrink-0"
                      style={{ color: accentColor[node.accent], width: 22, height: 22 }}
                      strokeWidth={1.5}
                    />
                    <span className="mt-0.5 text-[11px] font-semibold text-white leading-tight truncate max-w-[100px]">
                      {node.label}
                    </span>
                    <span className="text-[8px] font-medium uppercase tracking-wider" style={{ color: accentColor[node.accent], opacity: 0.7 }}>
                      {node.hint}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>

          {/* Bottom info */}
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur-sm">
            Entry → Auth → Modules → AI → Backend → External
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <AnimatePresence>
        {selected && SelectedIcon && (
          <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
            <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <SelectedIcon className="h-5 w-5" style={{ color: accentColor[selected.accent] }} />
                  {selected.detail.title}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: accentBg[selected.accent],
                          color: accentColor[selected.accent],
                          border: `1px solid ${accentColor[selected.accent]}`,
                        }}
                      >
                        {selected.layer}
                      </span>
                      <span className="text-muted-foreground">{selected.hint}</span>
                    </div>
                    <ul className="list-inside list-disc space-y-1.5 text-left text-sm text-muted-foreground">
                      {selected.detail.bullets.map((line) => (
                        <li key={line} className="break-words">{line}</li>
                      ))}
                    </ul>
                    {/* Connected nodes */}
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Connected to</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ARCH_EDGES
                          .filter((e) => e.source === selected.id || e.target === selected.id)
                          .map((e) => {
                            const otherId = e.source === selected.id ? e.target : e.source;
                            const other = ARCH_NODES.find((n) => n.id === otherId);
                            if (!other) return null;
                            return (
                              <button
                                key={e.id}
                                onClick={() => setOpenId(otherId)}
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
