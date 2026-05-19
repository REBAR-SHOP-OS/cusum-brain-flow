import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";

const throughput = [38, 42, 41, 45, 44, 48, 47, 50, 49, 52, 51, 48, 53, 55];

const gmActions: ActionItem[] = [
  { id: "1", severity: "high", title: "Machine M3 down — 42min", meta: "Maintenance dispatched", age: "42m", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "med", title: "Delivery route #DR-118 1h behind", meta: "Driver: Sattar · 4 stops left", age: "1h", cta: { label: "Reroute", onClick: () => {} } },
  { id: "3", severity: "med", title: "Work order WO-4821 stuck >24h", meta: "Cutting → Clearance gate", age: "26h", cta: { label: "Open", onClick: () => {} } },
];

export function GMDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="General Manager · Operations Cockpit"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      statusStrip={
        <>
          <StatusTile label="Orders Today" value="34" delta={{ value: "+3", direction: "up", good: true }} />
          <StatusTile label="On-Time %" value="92%" tone="ok" delta={{ value: "+1.2", direction: "up", good: true }} />
          <StatusTile label="Shop Utilization" value="78%" delta={{ value: "-2", direction: "down", good: false }} hint="4 of 5 machines" />
          <StatusTile label="On Clock" value="14" hint="Of 18 scheduled" />
          <StatusTile label="Backlog" value="3.2d" tone="warn" delta={{ value: "+0.4", direction: "up", good: false }} />
        </>
      }
      actionQueue={<Panel title="Cross-dept blockers"><ActionQueue items={gmActions} /></Panel>}
      pulse={
        <Panel title="Daily throughput (tons)">
          <div className="text-3xl font-mono tabular-nums">55</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Today · 14d trend</div>
          <Sparkline values={throughput} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Department leaderboard">
            <Row name="Shop Floor" value="92%" />
            <Row name="Sales" value="88%" />
            <Row name="Dispatch" value="84%" />
            <Row name="Estimation" value="79%" />
          </Panel>
          <Panel title="Shift coverage">
            <Row name="Morning (06–14)" value="6 / 7" />
            <Row name="Afternoon (14–22)" value="5 / 6" />
            <Row name="Night (22–06)" value="3 / 3" />
          </Panel>
          <Panel title="Stuck items">
            <Row name=">24h work orders" value="2" />
            <Row name=">7d quotes" value="4" />
            <Row name=">60d invoices" value="3" />
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
