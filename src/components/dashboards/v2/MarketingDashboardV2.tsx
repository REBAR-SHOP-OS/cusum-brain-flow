import { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { StatusTile, Panel, ActionQueue, Sparkline, ActionItem } from "./primitives";
import { ShortcutBar, ShortcutItem } from "./Shortcuts";
import { Share2, Megaphone, Video, Mail, Search } from "lucide-react";

const mktShortcuts: ShortcutItem[] = [
  { label: "Social Media", to: "/social-media-manager", icon: Share2 },
  { label: "Ad Director", to: "/ad-director", icon: Megaphone },
  { label: "Video Studio", to: "/video-studio", icon: Video },
  { label: "Email Marketing", to: "/email-marketing", icon: Mail },
  { label: "SEO", to: "/seo", icon: Search },
];


const seriesClicks = [320, 345, 380, 360, 410, 430, 425, 470, 495, 510, 540, 580, 605, 622];

const mktActions: ActionItem[] = [
  { id: "1", severity: "high", title: "3 posts awaiting Neel approval (publish blocked)", meta: "IG · TikTok · LinkedIn", age: "2h", cta: { label: "Open", onClick: () => {} } },
  { id: "2", severity: "med", title: "Wincher rank drop: 'rebar cutting toronto' #4 → #9", meta: "Last check 4h ago", age: "4h", cta: { label: "Open SEO", onClick: () => {} } },
  { id: "3", severity: "low", title: "Email campaign 'Spring 2026' draft pending review", meta: "Scheduled May 22", age: "1d", cta: { label: "Review", onClick: () => {} } },
];

export function MarketingDashboardV2({ roleSwitcher }: { roleSwitcher?: ReactNode }) {
  return (
    <DashboardShell
      title="Marketing · Content & Reach"
      subtitle="Live"
      roleSwitcher={roleSwitcher}
      shortcuts={<ShortcutBar items={mktShortcuts} />}
      statusStrip={
        <>
          <StatusTile label="Posts Scheduled" value="14" hint="Next 7d" />
          <StatusTile label="Approval Queue" value="3" tone="warn" hint="Awaiting Neel" />
          <StatusTile label="Daily Slots" value="4 / 5" delta={{ value: "1 left", direction: "flat" }} />
          <StatusTile label="GSC Clicks 7d" value="622" tone="ok" delta={{ value: "+14%", direction: "up", good: true }} />
          <StatusTile label="CTR" value="3.8%" delta={{ value: "+0.4", direction: "up", good: true }} />
        </>
      }
      actionQueue={<Panel title="Needs attention"><ActionQueue items={mktActions} /></Panel>}
      pulse={
        <Panel title="GSC clicks (14d)">
          <div className="text-3xl font-mono tabular-nums">622</div>
          <div className="text-[11px] text-[hsl(var(--v2-text-muted))] mb-2">Today · trending up</div>
          <Sparkline values={seriesClicks} />
        </Panel>
      }
      drilldowns={
        <>
          <Panel title="Per-platform reach (7d)">
            <Row name="Instagram" value="12.4K" />
            <Row name="TikTok" value="8.9K" />
            <Row name="LinkedIn" value="3.1K" />
            <Row name="Facebook" value="2.4K" />
          </Panel>
          <Panel title="SEO findings">
            <Row name="Critical" value="0" />
            <Row name="High" value="2" />
            <Row name="Medium" value="7" />
            <Row name="Low" value="14" />
          </Panel>
          <Panel title="Email campaigns (30d)">
            <Row name="Sent" value="4,820" />
            <Row name="Open rate" value="34%" />
            <Row name="Click rate" value="6.1%" />
            <Row name="Unsub" value="0.4%" />
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
