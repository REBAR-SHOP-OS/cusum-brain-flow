import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";

const cashSeries = [85, 92, 88, 95, 102, 98, 110, 115, 108, 121, 128, 132, 138, 145];

const items: ActionItem[] = [
  { id: "1", severity: "high", title: "3-way match mismatch: PO-4421 vs invoice INV-9821", meta: "Variance $1,240", age: "20m", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "med", title: "QuickBooks sync error — customer mapping", meta: "2 invoices stuck", age: "1h", cta: { label: "Fix", onClick: () => {} } },
  { id: "3", severity: "med", title: "Tax remittance due in 3d (GST/HST Q1)", meta: "$18,420", age: "3d", cta: { label: "Open", onClick: () => {} } },
  { id: "4", severity: "low", title: "Plaid variance flag: Operating $4,820", meta: "Bank vs ledger", age: "12m", cta: { label: "Review", onClick: () => {} } },
];

export function AccountingDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="Accounting · Cash Control"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      statusStrip={
        <>
          <StatusTile label="Bank Balance" value="$1.04M" tone="ok" hint="Plaid · live" />
          <StatusTile label="AR Aging" value="$287K" tone="warn" hint="3 inv >60d" />
          <StatusTile label="AP Due 7d" value="$94K" delta={{ value: "+$12K", direction: "up", good: false }} />
          <StatusTile label="Unmatched Pmts" value="2" tone="warn" />
          <StatusTile label="Payroll Next" value="May 24" hint="$72K est." />
        </>
      }
      actionQueue={<Panel title="Reconciliation queue"><ActionQueue items={items} /></Panel>}
      pulse={
        <Panel title="Cash flow (14d, $K)">
          <div className="text-3xl font-mono tabular-nums">+$145K</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Net inflow today</div>
          <Sparkline values={cashSeries} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="AR aging">
            <Row name="Current" value="$112K" />
            <Row name="1–30d" value="$84K" />
            <Row name="31–60d" value="$48K" />
            <Row name=">60d" value="$43K" />
          </Panel>
          <Panel title="Invoice status (30d)">
            <Row name="Paid" value="42" />
            <Row name="Sent" value="18" />
            <Row name="Overdue" value="6" />
            <Row name="Draft" value="3" />
          </Panel>
          <Panel title="Payment sources (30d)">
            <Row name="Stripe" value="$184K" />
            <Row name="Bank transfer" value="$298K" />
            <Row name="Cheque" value="$41K" />
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
