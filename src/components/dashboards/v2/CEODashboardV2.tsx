import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";
import { ShortcutBar, ShortcutItem } from "./Shortcuts";
import { Building2, Workflow, Calculator, Factory, Bot } from "lucide-react";
import { ReactNode } from "react";

const ceoShortcuts: ShortcutItem[] = [
  { label: "CEO Portal", to: "/ceo", icon: Building2 },
  { label: "Pipeline", to: "/pipeline", icon: Workflow },
  { label: "Accounting", to: "/accounting", icon: Calculator },
  { label: "Shop Floor", to: "/shop-floor", icon: Factory },
  { label: "Vizzy", to: "/vizzy", icon: Bot },
];


const cashSeries = [820, 845, 833, 870, 902, 895, 921, 940, 933, 968, 985, 1012, 1020, 1045];

const ceoActions: ActionItem[] = [
  { id: "1", severity: "high", title: "Plaid variance flagged — Operating account ($4,820)", meta: "Bank vs ledger", age: "12m", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "med", title: "PO #4421 awaiting your approval", meta: "Steel order · $38,900", age: "1h", cta: { label: "Approve", onClick: () => {} } },
  { id: "3", severity: "med", title: "Quote #Q-1182 stuck at 'awaiting customer' 7d", meta: "Sunrise Construction", age: "7d", cta: { label: "Nudge", onClick: () => {} } },
  { id: "4", severity: "low", title: "Monthly board pack ready for review", meta: "Auto-generated", age: "3h", cta: { label: "Open", onClick: () => {} } },
];

export function CEODashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="CEO · Business Heartbeat"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      statusStrip={
        <>
          <StatusTile label="Cash Position" value="$1.04M" tone="ok" delta={{ value: "+2.4%", direction: "up", good: true }} hint="vs last week" />
          <StatusTile label="MTD Revenue" value="$412K" delta={{ value: "+8.1%", direction: "up", good: true }} hint="Pacing +12% vs target" />
          <StatusTile label="Open AR" value="$287K" tone="warn" delta={{ value: "+$14K", direction: "up", good: false }} hint="3 invoices >60d" />
          <StatusTile label="Throughput" value="48 tons" delta={{ value: "+6%", direction: "up", good: true }} hint="Today" />
          <StatusTile label="Active Alerts" value="2" tone="bad" hint="1 high · 1 med" />
        </>
      }
      actionQueue={
        <Panel title="Needs your decision" action={<span className="text-[11px] text-[hsl(var(--v2-text-muted))]">{ceoActions.length} pending</span>}>
          <ActionQueue items={ceoActions} />
        </Panel>
      }
      pulse={
        <Panel title="30-day cash trend">
          <div className="text-3xl font-mono tabular-nums">$1.04M</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">+18% vs 30d ago</div>
          <Sparkline values={cashSeries} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Sales"><DeptCard ok={false} headline="Pipeline $1.8M" sub="Win rate 34% · 7 hot leads" /></Panel>
          <Panel title="Production"><DeptCard ok headline="Throughput 48t/day" sub="On-time 92% · 0 holds" /></Panel>
          <Panel title="Accounting"><DeptCard ok={false} headline="AR aging $287K" sub="3 invoices >60d" /></Panel>
        </>
      }
    />
  );
}

function DeptCard({ ok, headline, sub }: { ok: boolean; headline: string; sub: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${ok ? "bg-[hsl(var(--v2-ok))]" : "bg-[hsl(var(--v2-warn))]"}`} />
        <div className="text-sm">{headline}</div>
      </div>
      <div className="text-[11px] text-[hsl(var(--v2-text-muted))]">{sub}</div>
    </div>
  );
}
