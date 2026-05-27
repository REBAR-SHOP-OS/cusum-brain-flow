import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

/**
 * Industrial command-center shell — ported from REBAR OS Core.
 * Wrap a workspace in `.industrial` so the dark command-center palette
 * applies to all descendant components without changing global theme.
 */
export function IndustrialFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("industrial h-full min-h-0 overflow-y-auto", className)}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  status,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-border pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {status && <div className="mt-3 flex flex-wrap items-center gap-2">{status}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function IndustrialTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; count?: number }[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const btn = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (!btn || !container) return;
    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (btnLeft < viewLeft) {
      container.scrollTo({ left: btnLeft - 8, behavior: "smooth" });
    } else if (btnRight > viewRight) {
      container.scrollTo({ left: btnRight - container.clientWidth + 8, behavior: "smooth" });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="mb-6 flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1"
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(it.id, el);
              else buttonRefs.current.delete(it.id);
            }}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {it.label}
            {typeof it.count === "number" && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function IndustrialCard({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] transition-colors",
        interactive && "hover:border-primary/40 hover:bg-card/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "info" | "warning" | "success" | "destructive";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    info: "text-info",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  };
  return (
    <IndustrialCard className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </IndustrialCard>
  );
}

export function StateBadge({
  state,
}: {
  state: "running" | "idle" | "blocked" | "down" | "queued" | "ready" | "completed" | "needs_fix" | "approved" | "draft";
}) {
  const map: Record<string, { dot: string; text: string; bg: string; label: string }> = {
    running:    { dot: "bg-success",          text: "text-success",          bg: "bg-success/10",     label: "Running" },
    idle:       { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted/40",       label: "Idle" },
    blocked:    { dot: "bg-destructive",      text: "text-destructive",      bg: "bg-destructive/10", label: "Blocked" },
    down:       { dot: "bg-destructive",      text: "text-destructive",      bg: "bg-destructive/15", label: "Down" },
    queued:     { dot: "bg-info",             text: "text-info",             bg: "bg-info/10",        label: "Queued" },
    ready:      { dot: "bg-primary",          text: "text-primary",          bg: "bg-primary/10",     label: "Ready" },
    completed:  { dot: "bg-success",          text: "text-success",          bg: "bg-success/10",     label: "Completed" },
    needs_fix:  { dot: "bg-warning",          text: "text-warning",          bg: "bg-warning/10",     label: "Needs fix" },
    approved:   { dot: "bg-success",          text: "text-success",          bg: "bg-success/10",     label: "Approved" },
    draft:      { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted/40",       label: "Draft" },
  };
  const m = map[state] ?? map.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", m.bg, m.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {it.onClick ? (
            <button onClick={it.onClick} className="hover:text-foreground">
              {it.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? "text-foreground" : ""}>{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="h-3 w-3 opacity-50" />}
        </span>
      ))}
    </nav>
  );
}

export function EmptyShell({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  );
}
