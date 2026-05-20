import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";
import { ShortcutBar, ShortcutItem } from "./Shortcuts";
import { Factory, Scissors, Monitor, ShieldCheck, Truck, Clock } from "lucide-react";

const sfShortcuts: ShortcutItem[] = [
  { label: "Shop Floor", to: "/shop-floor", icon: Factory },
  { label: "Cutter", to: "/shopfloor/cutter", icon: Scissors },
  { label: "Station", to: "/shopfloor/station", icon: Monitor },
  { label: "Clearance", to: "/shopfloor/clearance", icon: ShieldCheck },
  { label: "Delivery Ops", to: "/shopfloor/delivery-ops", icon: Truck },
  { label: "Time Clock", to: "/timeclock", icon: Clock },
];


const tonsSeries = [38, 42, 44, 41, 47, 49, 48, 52, 54, 53, 55, 58, 60, 55];

const items: ActionItem[] = [
  { id: "1", severity: "high", title: "Quality hold: bundle B-882 wrong bend angle", meta: "Station 2 · WO-4801", age: "8m", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "high", title: "Machine M3 down — 42min", meta: "Maintenance dispatched", age: "42m", cta: { label: "Open", onClick: () => {} } },
  { id: "3", severity: "med", title: "Cutter plan conflict: 2 jobs claim same stock #20", meta: "Auto-rebalance suggested", age: "20m", cta: { label: "Resolve", onClick: () => {} } },
  { id: "4", severity: "med", title: "Material pool low: #5 bar (3 lengths left)", meta: "Reorder threshold hit", age: "1h", cta: { label: "Order", onClick: () => {} } },
];

export function ShopFloorDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="Shop Floor · Production Cockpit"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      shortcuts={<ShortcutBar items={sfShortcuts} />}
      statusStrip={
        <>
          <StatusTile label="Active Stations" value="4 / 5" tone="warn" hint="M3 down" />
          <StatusTile label="Tons Cut Today" value="55" tone="ok" delta={{ value: "+6%", direction: "up", good: true }} />
          <StatusTile label="Clearance Queue" value="8" hint="2 waiting QC" />
          <StatusTile label="Loading Queue" value="3" />
          <StatusTile label="Idle Machines" value="1" tone="bad" hint="M3 · 42m" />
        </>
      }
      actionQueue={<Panel title="Shop blockers"><ActionQueue items={items} /></Panel>}
      pulse={
        <Panel title="Tons cut (14d)">
          <div className="text-3xl font-mono tabular-nums">55</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Today · 14d avg 49.8</div>
          <Sparkline values={tonsSeries} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Per-machine throughput (today)">
            <Row name="M1 Shear" value="14t" />
            <Row name="M2 Bender" value="12t" />
            <Row name="M3 Combo" value="0t" />
            <Row name="M4 Auto" value="17t" />
            <Row name="M5 Heavy" value="12t" />
          </Panel>
          <Panel title="Bundle status">
            <Row name="In production" value="11" />
            <Row name="Awaiting clearance" value="8" />
            <Row name="Ready to ship" value="6" />
          </Panel>
          <Panel title="Waste bank (today)">
            <Row name="Reusable drops" value="42" />
            <Row name="Scrap %" value="2.1%" />
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
