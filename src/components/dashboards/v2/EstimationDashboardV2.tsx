import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";

const series = [22, 25, 28, 26, 31, 33, 30, 35, 38, 36, 40, 42, 45, 48];

const items: ActionItem[] = [
  { id: "1", severity: "high", title: "PDF #E-2210 extraction failed — corrupted shape", meta: "Apex Construction · 14 pages", age: "12m", cta: { label: "Reopen", onClick: () => {} } },
  { id: "2", severity: "med", title: "Imperial conversion warning: plan P-1102", meta: "Mixed ft-in / decimal detected", age: "1h", cta: { label: "Review", onClick: () => {} } },
  { id: "3", severity: "low", title: "5 plans pending detailed list handoff", meta: "Ready for office team", age: "3h", cta: { label: "Open", onClick: () => {} } },
];

export function EstimationDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="Estimation · Extract Workbench"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      statusStrip={
        <>
          <StatusTile label="PDFs in Queue" value="7" hint="3 priority" />
          <StatusTile label="Extracted Today" value="48" tone="ok" delta={{ value: "+12", direction: "up", good: true }} />
          <StatusTile label="Avg Extract Time" value="2.4m" delta={{ value: "-18s", direction: "down", good: true }} />
          <StatusTile label="Unit Accuracy" value="97%" tone="ok" />
          <StatusTile label="Sanity Flags" value="2" tone="warn" />
        </>
      }
      actionQueue={<Panel title="Needs review"><ActionQueue items={items} /></Panel>}
      pulse={
        <Panel title="Extractions (14d)">
          <div className="text-3xl font-mono tabular-nums">48</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Today · best week-to-date</div>
          <Sparkline values={series} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="By unit type">
            <Row name="ft-in" value="62%" />
            <Row name="decimal ft" value="24%" />
            <Row name="metric" value="14%" />
          </Panel>
          <Panel title="AI cost (today)">
            <Row name="OpenAI" value="$4.21" />
            <Row name="Gemini" value="$2.18" />
            <Row name="Total" value="$6.39" />
          </Panel>
          <Panel title="Pending handoff">
            <Row name="To Detailed List" value="5" />
            <Row name="To Production Queue" value="3" />
            <Row name="To Order Calculator" value="2" />
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
