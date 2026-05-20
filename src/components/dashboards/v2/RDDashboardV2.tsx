import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";
import { ShortcutBar, ShortcutItem } from "./Shortcuts";
import { Hammer, Network, Brain, Zap, Shield } from "lucide-react";

const rdShortcuts: ShortcutItem[] = [
  { label: "App Builder", to: "/app-builder", icon: Hammer },
  { label: "Architecture", to: "/architecture", icon: Network },
  { label: "Brain", to: "/brain", icon: Brain },
  { label: "Automations", to: "/automations", icon: Zap },
  { label: "Admin", to: "/admin", icon: Shield },
];


const adoption = [8, 12, 18, 22, 28, 34, 40, 48, 54, 62, 68, 74, 78, 82];

const items: ActionItem[] = [
  { id: "1", severity: "high", title: "Experiment 'blitz-v2' error rate 4.2% — auto-throttled", meta: "Last hour", age: "1h", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "med", title: "Feature flag 'voice-relay' stuck at 50% rollout 38d", meta: "Decide promote or rollback", age: "38d", cta: { label: "Decide", onClick: () => {} } },
  { id: "3", severity: "med", title: "Security finding: 2 SECURITY DEFINER fns missing search_path", meta: "Scanner", age: "2h", cta: { label: "Fix", onClick: () => {} } },
  { id: "4", severity: "low", title: "DB linter: 3 views without security_invoker", meta: "Audit", age: "1d", cta: { label: "Review", onClick: () => {} } },
];

export function RDDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="R&D · Experiments & Adoption"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      statusStrip={
        <>
          <StatusTile label="Active Experiments" value="6" hint="2 in promotion" />
          <StatusTile label="Avg Rollout" value="58%" delta={{ value: "+4", direction: "up", good: true }} />
          <StatusTile label="Feature Flags" value="24" hint="3 stuck >30d" />
          <StatusTile label="Errors 24h" value="42" tone="warn" delta={{ value: "+12", direction: "up", good: false }} />
          <StatusTile label="Edge Fn Cost" value="$3.84" hint="Today" />
        </>
      }
      actionQueue={<Panel title="R&D queue"><ActionQueue items={items} /></Panel>}
      pulse={
        <Panel title="Feature adoption (14d, %)">
          <div className="text-3xl font-mono tabular-nums">82%</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Avg across active rollouts</div>
          <Sparkline values={adoption} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Active rollouts">
            <Row name="blitz-v2" value="50%" />
            <Row name="voice-relay" value="50%" />
            <Row name="ad-director-v3" value="100%" />
            <Row name="vision-events" value="25%" />
          </Panel>
          <Panel title="Edge fn latency (p95)">
            <Row name="ai-extract" value="1.8s" />
            <Row name="quote-gen" value="2.4s" />
            <Row name="social-publish" value="0.9s" />
          </Panel>
          <Panel title="Cron health">
            <Row name="Healthy" value="22" />
            <Row name="Degraded" value="2" />
            <Row name="Failing" value="0" />
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
