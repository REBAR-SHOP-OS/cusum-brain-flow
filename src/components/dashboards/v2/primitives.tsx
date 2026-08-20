import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- StatusTile ---------- */
export interface StatusTileProps {
  label: string;
  value: string | number;
  delta?: { value: string; direction: "up" | "down" | "flat"; good?: boolean };
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad";
  onClick?: () => void;
}

export function StatusTile({ label, value, delta, hint, tone = "default", onClick }: StatusTileProps) {
  const toneRing =
    tone === "ok" ? "before:bg-[hsl(var(--v2-ok))]" :
    tone === "warn" ? "before:bg-[hsl(var(--v2-warn))]" :
    tone === "bad" ? "before:bg-[hsl(var(--v2-bad))]" :
    "before:bg-[hsl(var(--v2-accent))]";

  const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  const deltaColor = delta
    ? (delta.good === undefined ? "text-[hsl(var(--v2-text-muted))]"
      : delta.good ? "text-[hsl(var(--v2-ok))]" : "text-[hsl(var(--v2-bad))]")
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-lg border border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-panel))]",
        "px-4 py-3 transition-colors hover:bg-[hsl(var(--v2-panel-2))]",
        "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r",
        toneRing,
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums text-[hsl(var(--v2-text))] font-mono">
          {value}
        </div>
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs tabular-nums", deltaColor)}>
            <DeltaIcon className="w-3 h-3" />
            {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[hsl(var(--v2-text-muted))]">{hint}</div>}
    </button>
  );
}

/* ---------- Panel ---------- */
export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(
      "rounded-lg border border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-panel))]",
      className,
    )}>
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--v2-border))]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--v2-text))]">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ---------- ActionQueue ---------- */
export interface ActionItem {
  id: string;
  severity: "low" | "med" | "high";
  title: string;
  meta?: string;
  age?: string;
  cta?: { label: string; onClick: () => void };
}

export function ActionQueue({ items, emptyMessage = "All clear — nothing needs you right now." }: {
  items: ActionItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="text-2xl mb-1">✓</div>
        <div className="text-sm text-[hsl(var(--v2-text-muted))]">{emptyMessage}</div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[hsl(var(--v2-border))] -m-4">
      {items.map((it) => {
        const dot =
          it.severity === "high" ? "bg-[hsl(var(--v2-bad))]" :
          it.severity === "med" ? "bg-[hsl(var(--v2-warn))]" :
          "bg-[hsl(var(--v2-accent))]";
        return (
          <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--v2-panel-2))]">
            <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[hsl(var(--v2-text))] truncate">{it.title}</div>
              {it.meta && <div className="text-[11px] text-[hsl(var(--v2-text-muted))] truncate">{it.meta}</div>}
            </div>
            {it.age && <span className="text-[11px] tabular-nums text-[hsl(var(--v2-text-muted))] font-mono">{it.age}</span>}
            {it.cta && (
              <button
                onClick={it.cta.onClick}
                className="text-xs px-2.5 py-1 rounded border border-[hsl(var(--v2-border))] text-[hsl(var(--v2-text))] hover:bg-[hsl(var(--v2-accent))] hover:text-white transition-colors"
              >
                {it.cta.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Pulse (simple sparkline / feed shell) ---------- */
export function Sparkline({ values, height = 60 }: { values: number[]; height?: number }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 240;
  const stepX = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="v2spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--v2-accent))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--v2-accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="hsl(var(--v2-accent))" strokeWidth="1.5" points={points} />
      <polygon fill="url(#v2spark)" points={`0,${height} ${points} ${w},${height}`} />
    </svg>
  );
}
