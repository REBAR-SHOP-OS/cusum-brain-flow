import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Webhook,
  Database,
  Globe,
  Bell,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Accent = "cyan" | "emerald" | "violet" | "orange";

type ArchNode = {
  id: string;
  label: string;
  hint: string;
  accent: Accent;
  Icon: React.ElementType;
  x: number;
  y: number;
  large?: boolean;
  detail: { title: string; bullets: string[] };
};

const NODES: ArchNode[] = [
  {
    id: "users",
    label: "People",
    hint: "App + login",
    accent: "cyan",
    Icon: Users,
    x: 110,
    y: 140,
    detail: {
      title: "Browser & authentication",
      bullets: [
        "React routes and pages: src/App.tsx",
        "Supabase Auth session: src/lib/auth.tsx (signIn, signUp, onAuthStateChange)",
      ],
    },
  },
  {
    id: "automation",
    label: "Signals",
    hint: "Webhooks & jobs",
    accent: "emerald",
    Icon: Webhook,
    x: 110,
    y: 420,
    detail: {
      title: "Incoming automation",
      bullets: [
        "RingCentral webhook: supabase/functions/ringcentral-webhook/index.ts",
        "Scheduled HTTP (pg_cron → ringcentral-sync): supabase/migrations/20260402002613_166b3c6e-8cb5-4057-9a82-5475e2635f83.sql",
      ],
    },
  },
  {
    id: "core",
    label: "Core",
    hint: "Data + APIs",
    accent: "orange",
    Icon: Database,
    x: 500,
    y: 280,
    large: true,
    detail: {
      title: "Supabase (Postgres + Edge Functions)",
      bullets: [
        "PostgreSQL schema & data: supabase/migrations/",
        "Edge function wrapper: supabase/functions/_shared/requestHandler.ts",
        "Business logic in supabase/functions/*/index.ts (Stripe, social, Vizzy, QB, …)",
      ],
    },
  },
  {
    id: "integrations",
    label: "Partners",
    hint: "HTTP out",
    accent: "violet",
    Icon: Globe,
    x: 890,
    y: 140,
    detail: {
      title: "Outbound integrations (examples)",
      bullets: [
        "Payments: supabase/functions/stripe-payment/index.ts",
        "Telephony sync: supabase/functions/ringcentral-sync (invoked by cron above)",
        "Social publish: supabase/functions/social-publish/index.ts",
      ],
    },
  },
  {
    id: "delivery",
    label: "You",
    hint: "UI + push",
    accent: "cyan",
    Icon: Bell,
    x: 890,
    y: 420,
    detail: {
      title: "Responses & notifications",
      bullets: [
        "In-app UI: React + TanStack Query patterns across src/",
        "Push pipeline: DB trigger on notifications → supabase/functions/push-on-notify → send-push (see supabase/migrations/20260401224944_942b953a-d09b-4dbf-bdf5-96e2e2038df2.sql)",
      ],
    },
  },
];

const accentStyles: Record<Accent, { border: string; glow: string; icon: string }> = {
  cyan: {
    border: "border-cyan-400/90",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.35)]",
    icon: "text-cyan-200",
  },
  emerald: {
    border: "border-emerald-400/90",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.35)]",
    icon: "text-emerald-200",
  },
  violet: {
    border: "border-violet-400/90",
    glow: "shadow-[0_0_22px_rgba(167,139,250,0.4)]",
    icon: "text-violet-200",
  },
  orange: {
    border: "border-orange-400",
    glow: "shadow-[0_0_32px_rgba(251,146,60,0.55)]",
    icon: "text-orange-100",
  },
};

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 40;
  const oy = (dx / len) * 40;
  return `M ${x1} ${y1} Q ${mx + ox} ${my + oy} ${x2} ${y2}`;
}

const EDGES: [string, string][] = [
  ["users", "core"],
  ["automation", "core"],
  ["core", "integrations"],
  ["core", "delivery"],
];

const CANVAS_W = 1000;
const CANVAS_H = 560;

export default function Architecture() {
  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);

  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const draggingRef = useRef(false);
  const dragRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(2.2, Math.max(0.55, prev - e.deltaY * 0.0012)));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onPanPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    dragRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
  };

  const onPanPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const d = dragRef.current;
    setPan({
      x: d.x + (e.clientX - d.px),
      y: d.y + (e.clientY - d.py),
    });
  };

  const onPanPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const selected = openId ? byId[openId] : null;
  const DetailIcon = selected?.Icon;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">System architecture</h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Drag to pan · Scroll to zoom · Click a node for sources
        </p>
      </header>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0c2140_0%,_#050a14_55%,_#020617_100%)]"
      >
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-slate-950/70 p-1.5 shadow-lg backdrop-blur-md">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-white hover:bg-white/10"
            onClick={resetView}
            aria-label="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center border-t border-white/10 pt-1.5">
            <Move className="h-3.5 w-3.5 text-white/50" aria-hidden />
          </div>
        </div>

        <motion.div
          className="absolute inset-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerLeave={() => {
            draggingRef.current = false;
          }}
        >
          <motion.div
            className="relative will-change-transform"
            style={{ width: CANVAS_W, height: CANVAS_H, x: pan.x, y: pan.y, scale: zoom }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <filter id="archGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              {EDGES.map(([a, b], i) => {
                const na = byId[a];
                const nb = byId[b];
                if (!na || !nb) return null;
                return (
                  <path
                    key={`${a}-${b}-${i}`}
                    d={edgePath(na.x, na.y, nb.x, nb.y)}
                    fill="none"
                    stroke="url(#edgeGrad)"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    filter="url(#archGlow)"
                    opacity={0.92}
                  />
                );
              })}
            </svg>

            {NODES.map((node) => {
              const st = accentStyles[node.accent];
              const isHover = hoverId === node.id;
              const Icon = node.Icon;
              const w = node.large ? 168 : 128;
              const h = node.large ? 168 : 128;
              return (
                <motion.button
                  key={node.id}
                  type="button"
                  className={cn(
                    "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border-2 bg-slate-950/55 text-center shadow-xl backdrop-blur-md",
                    st.border,
                    st.glow,
                    isHover && "ring-2 ring-white/30",
                  )}
                  style={{ left: node.x, top: node.y, width: w, height: h, zIndex: 10 }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: isHover ? (node.large ? 1.06 : 1.08) : 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setOpenId(node.id)}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <Icon
                    className={cn(
                      "shrink-0 drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]",
                      node.large ? "h-14 w-14" : "h-11 w-11",
                      st.icon,
                    )}
                    strokeWidth={1.35}
                  />
                  <span className="mt-1.5 max-w-[90%] truncate text-sm font-semibold text-white">{node.label}</span>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300/90">
                    {node.hint}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur-sm">
          Inputs ← Core → Outputs
        </div>
      </div>

      <AnimatePresence>
        {selected && DetailIcon && (
          <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
            <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <DetailIcon className="h-5 w-5 text-primary" />
                  {selected.detail.title}
                </DialogTitle>
                <DialogDescription asChild>
                  <ul className="mt-3 list-inside list-disc space-y-2 text-left text-sm text-muted-foreground">
                    {selected.detail.bullets.map((line) => (
                      <li key={line} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}