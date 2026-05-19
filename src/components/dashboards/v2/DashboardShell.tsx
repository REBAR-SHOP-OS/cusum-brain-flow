import { ReactNode } from "react";
import { Search, Bell, ChevronDown } from "lucide-react";
import { v2StyleVars } from "./theme";

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  roleSwitcher?: ReactNode;
  statusStrip: ReactNode;
  actionQueue: ReactNode;
  pulse: ReactNode;
  drilldowns?: ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  roleSwitcher,
  statusStrip,
  actionQueue,
  pulse,
  drilldowns,
}: DashboardShellProps) {
  return (
    <div
      style={v2StyleVars}
      className="min-h-screen bg-[hsl(var(--v2-canvas))] text-[hsl(var(--v2-text))]"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-canvas))]/95 backdrop-blur">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold tracking-wide truncate">{title}</h1>
          {subtitle && (
            <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))] truncate">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex-1" />
        {roleSwitcher}
        <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-[hsl(var(--v2-border))] text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]">
          Today <ChevronDown className="w-3 h-3" />
        </button>
        <button className="p-1.5 rounded text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]">
          <Search className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))] relative">
          <Bell className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <div className="px-5 py-5 space-y-5">
        {/* Row 1 — Status strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statusStrip}
        </div>

        {/* Row 2 — Action queue + Pulse */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">{actionQueue}</div>
          <div className="lg:col-span-2">{pulse}</div>
        </div>

        {/* Row 3 — Drilldowns */}
        {drilldowns && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {drilldowns}
          </div>
        )}
      </div>
    </div>
  );
}
