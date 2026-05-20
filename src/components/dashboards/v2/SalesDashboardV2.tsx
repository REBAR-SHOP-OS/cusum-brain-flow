import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";
import { ShortcutBar, ShortcutItem } from "./Shortcuts";
import { Briefcase, Workflow, FileText, Users, Target } from "lucide-react";

const salesShortcuts: ShortcutItem[] = [
  { label: "Sales Hub", to: "/sales", icon: Briefcase },
  { label: "Pipeline", to: "/pipeline", icon: Workflow },
  { label: "Quotations", to: "/sales/quotations", icon: FileText },
  { label: "Customers", to: "/customers", icon: Users },
  { label: "Lead Scoring", to: "/lead-scoring", icon: Target },
];


const pipelineSeries = [1.2, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.7, 1.75, 1.78, 1.8].map(v => v * 100);

const salesActions: ActionItem[] = [
  { id: "1", severity: "high", title: "Hot lead: Cornerstone Builders — no contact 6d", meta: "Score 92 · $145K opportunity", age: "6d", cta: { label: "Call", onClick: () => {} } },
  { id: "2", severity: "med", title: "Quote #Q-1182 awaiting customer 7d", meta: "Sunrise Construction · $38K", age: "7d", cta: { label: "Nudge", onClick: () => {} } },
  { id: "3", severity: "med", title: "Blitz Agent zero-price recovery — 3 quotes", meta: "Auto-rescued, review pricing", age: "1h", cta: { label: "Review", onClick: () => {} } },
  { id: "4", severity: "low", title: "Follow-up due: Mira @ Apex Construction", meta: "Last touch 14d", age: "14d", cta: { label: "Open", onClick: () => {} } },
];

export function SalesDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="Sales · Pipeline Command"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      shortcuts={<ShortcutBar items={salesShortcuts} />}
      statusStrip={
        <>
          <StatusTile label="Pipeline" value="$1.8M" tone="ok" delta={{ value: "+$140K", direction: "up", good: true }} />
          <StatusTile label="Win Rate" value="34%" delta={{ value: "+2.1", direction: "up", good: true }} hint="Last 30d" />
          <StatusTile label="Quotes Pending" value="12" tone="warn" hint="4 stale >5d" />
          <StatusTile label="Hot Leads" value="7" delta={{ value: "+2", direction: "up", good: true }} hint="Score ≥ 80" />
          <StatusTile label="Calls Today" value="23" delta={{ value: "+5", direction: "up", good: true }} />
        </>
      }
      actionQueue={<Panel title="Action queue"><ActionQueue items={salesActions} /></Panel>}
      pulse={
        <Panel title="Pipeline value (30d, $K)">
          <div className="text-3xl font-mono tabular-nums">$1.8M</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">+8.4% vs last month</div>
          <Sparkline values={pipelineSeries} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Stage funnel">
            <Funnel rows={[{ label: "Lead", v: 142 }, { label: "Qualified", v: 68 }, { label: "Quoted", v: 31 }, { label: "Won", v: 11 }]} />
          </Panel>
          <Panel title="Top customers (90d)">
            <Row name="Apex Construction" value="$182K" />
            <Row name="Cornerstone Builders" value="$145K" />
            <Row name="Sunrise Construction" value="$98K" />
            <Row name="Northpoint Dev" value="$71K" />
          </Panel>
          <Panel title="Lost reasons (30d)">
            <Row name="Price" value="38%" />
            <Row name="Timing" value="24%" />
            <Row name="Competitor" value="19%" />
            <Row name="No decision" value="19%" />
          </Panel>
        </>
      }
    />
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[hsl(var(--v2-text-muted))]">{name}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function Funnel({ rows }: { rows: { label: string; v: number }[] }) {
  const max = Math.max(...rows.map(r => r.v));
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-[hsl(var(--v2-text-muted))]">{r.label}</span>
            <span className="font-mono tabular-nums">{r.v}</span>
          </div>
          <div className="h-1.5 rounded bg-[hsl(var(--v2-canvas))] overflow-hidden">
            <div className="h-full bg-[hsl(var(--v2-accent))]" style={{ width: `${(r.v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
