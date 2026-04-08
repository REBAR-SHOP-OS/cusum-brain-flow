import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardList, Clock, BarChart3, Users, Copy, Activity, Globe, Mail, Database, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDetailedActivityReport } from "@/hooks/useDetailedActivityReport";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { formatDateInTimezone } from "@/lib/dateConfig";
import { toast } from "sonner";
import type { ActivityEvent } from "@/hooks/useUserActivityLog";

type SectionType = "activity" | "timeclock" | "overview" | "team";

interface Props {
  sectionType: SectionType;
  profileId: string;
  userId: string | null;
  userName: string;
  date: Date;
  timezone: string;
}

function humanLabel(eventType: string): string {
  const map: Record<string, string> = {
    page_visit: "Visited page",
    email_sent: "Sent email",
    email_deleted: "Deleted email",
    email_archived: "Archived email",
    agent_query: "AI interaction",
    lead_created: "Created lead",
    lead_updated: "Updated lead",
    lead_deleted: "Deleted lead",
    order_created: "Created order",
    order_updated: "Updated order",
    barlist_approved: "Approved barlist",
    barlist_created: "Created barlist",
    machine_run_started: "Started machine run",
    machine_run_completed: "Completed machine run",
    delivery_created: "Created delivery",
    delivery_updated: "Updated delivery",
    project_created: "Created project",
    project_updated: "Updated project",
    customer_created: "Created customer",
    customer_updated: "Updated customer",
  };
  return map[eventType] || eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryBadge(eventType: string, entityType: string): { label: string; className: string } {
  if (eventType === "page_visit") return { label: "Page", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
  if (eventType.startsWith("email") || entityType === "email") return { label: "Email", className: "bg-green-500/15 text-green-400 border-green-500/20" };
  if (eventType.includes("agent") || entityType === "agent") return { label: "AI", className: "bg-purple-500/15 text-purple-400 border-purple-500/20" };
  return { label: "Action", className: "bg-orange-500/15 text-orange-400 border-orange-500/20" };
}

function ActivityReport({ userId, date, timezone, userName }: { userId: string | null; date: Date; timezone: string; userName: string }) {
  const { data: report, isLoading } = useDetailedActivityReport(userId, date);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading report…</p>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-muted-foreground p-4">No activities recorded for this date.</p>;

  const copyAll = () => {
    const lines = [
      `📊 System Performance Report — ${userName}`,
      `Date: ${formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}`,
      `Total Actions: ${report.totalCount}`,
      `Most Active Hour: ${report.mostActiveHour || "N/A"}`,
      "",
      "── By Event Type ──",
      ...report.byEventType.map((b) => `  ${humanLabel(b.eventType)}: ${b.count}`),
      "",
      "── By Entity Type ──",
      ...report.byEntityType.map((b) => `  ${b.entityType}: ${b.count}`),
      "",
      "── Hourly Timeline ──",
      ...report.hourlyGroups.map((g) => `  ${g.label}: ${g.events.length} action(s)`),
      "",
      "── Full Activity Log ──",
      ...report.allEvents.map(
        (ev) =>
          `  [${formatDateInTimezone(ev.created_at, timezone, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}] ${humanLabel(ev.event_type)} — ${ev.description || ev.entity_type}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Full report copied to clipboard");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}
        </p>
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{report.totalCount}</p>
          <p className="text-xs text-muted-foreground">Total Actions</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{report.byEventType.length}</p>
          <p className="text-xs text-muted-foreground">Event Types</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-primary">{report.mostActiveHour || "—"}</p>
          <p className="text-xs text-muted-foreground">Most Active Hour</p>
        </div>
      </div>

      {/* By Event Type */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Breakdown by Event Type</h4>
        <div className="space-y-1.5">
          {report.byEventType.map((b) => (
            <div key={b.eventType} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/20">
              <span className="text-foreground">{humanLabel(b.eventType)}</span>
              <span className="font-medium text-primary">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Entity Type */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Breakdown by Entity Type</h4>
        <div className="space-y-1.5">
          {report.byEntityType.map((b) => (
            <div key={b.entityType} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/20">
              <span className="text-foreground capitalize">{b.entityType}</span>
              <span className="font-medium text-primary">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Timeline */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Hourly Timeline</h4>
        <div className="space-y-1">
          {report.hourlyGroups.map((g) => {
            const maxEvents = Math.max(...report.hourlyGroups.map((h) => h.events.length));
            const pct = maxEvents > 0 ? (g.events.length / maxEvents) * 100 : 0;
            return (
              <div key={g.hour} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-muted-foreground text-xs shrink-0">{g.label}</span>
                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                  <div className="h-full bg-primary/60 rounded" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-xs text-right font-medium">{g.events.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Log with color-coded badges */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Full Activity Log ({report.allEvents.length})</h4>
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {report.allEvents.map((ev) => {
            const badge = getCategoryBadge(ev.event_type, ev.entity_type);
            return (
              <div key={ev.id} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-muted/10 border border-border/50">
                <span className="text-muted-foreground shrink-0 w-[72px]">
                  {formatDateInTimezone(ev.created_at, timezone, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                </span>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{humanLabel(ev.event_type)}</span>
                  {ev.description && (
                    <p className="text-muted-foreground mt-0.5 leading-tight">{ev.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeClockReport({ profileId, userId, date, timezone, userName }: { profileId: string; userId: string | null; date: Date; timezone: string; userName: string }) {
  const { data: perf, isLoading } = useUserPerformance(profileId, userId, date);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading report…</p>;
  if (!perf || perf.clockEntries.length === 0) return <p className="text-sm text-muted-foreground p-4">No clock entries for this date.</p>;

  const entries = perf.clockEntries;
  let totalGrossMin = 0;
  let totalBreakMin = 0;

  for (const e of entries) {
    const startMs = new Date(e.clock_in).getTime();
    const endMs = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    totalGrossMin += (endMs - startMs) / 60000;
    totalBreakMin += e.break_minutes || 0;
  }

  const totalNetMin = totalGrossMin - totalBreakMin;
  const overtime = totalNetMin > 480; // >8h

  const fmtDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}m`;
  };

  const copyAll = () => {
    const lines = [
      `⏰ Time Clock Report — ${userName}`,
      `Date: ${formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}`,
      `Shifts: ${entries.length}`,
      `Gross Hours: ${fmtDuration(totalGrossMin)}`,
      `Break Time: ${fmtDuration(totalBreakMin)}`,
      `Net Hours: ${fmtDuration(totalNetMin)}`,
      overtime ? `⚠️ OVERTIME DETECTED` : "",
      "",
      "── Shift Details ──",
      ...entries.map((e, i) => {
        const inT = formatDateInTimezone(e.clock_in, timezone, { hour: "numeric", minute: "2-digit", hour12: true });
        const outT = e.clock_out
          ? formatDateInTimezone(e.clock_out, timezone, { hour: "numeric", minute: "2-digit", hour12: true })
          : "Active";
        const dur = ((e.clock_out ? new Date(e.clock_out).getTime() : Date.now()) - new Date(e.clock_in).getTime()) / 60000;
        return `  Shift ${entries.length - i}: ${inT} → ${outT} (${fmtDuration(dur)}, Break: ${e.break_minutes || 0}m)${e.notes ? ` — ${e.notes}` : ""}`;
      }),
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Time clock report copied");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}
        </p>
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy Report
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{entries.length}</p>
          <p className="text-xs text-muted-foreground">Shifts</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{fmtDuration(totalGrossMin)}</p>
          <p className="text-xs text-muted-foreground">Gross Hours</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{fmtDuration(totalBreakMin)}</p>
          <p className="text-xs text-muted-foreground">Breaks</p>
        </div>
        <div className={`rounded-lg border p-3 text-center ${overtime ? "border-destructive bg-destructive/10" : "border-border bg-muted/30"}`}>
          <p className={`text-2xl font-bold ${overtime ? "text-destructive" : "text-foreground"}`}>{fmtDuration(totalNetMin)}</p>
          <p className="text-xs text-muted-foreground">{overtime ? "Net (Overtime!)" : "Net Hours"}</p>
        </div>
      </div>

      {/* Shift Details */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Shift Details</h4>
        <div className="space-y-2">
          {[...entries].reverse().map((e, i) => {
            const inT = formatDateInTimezone(e.clock_in, timezone, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
            const outT = e.clock_out
              ? formatDateInTimezone(e.clock_out, timezone, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })
              : "🟢 Active";
            const dur = ((e.clock_out ? new Date(e.clock_out).getTime() : Date.now()) - new Date(e.clock_in).getTime()) / 60000;
            return (
              <div key={i} className="rounded-lg border border-border bg-muted/10 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">Shift {i + 1}</span>
                  <span className="text-sm font-semibold text-primary">{fmtDuration(dur)}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>In: {inT} → Out: {outT}</p>
                  {(e.break_minutes ?? 0) > 0 && <p>Break: {e.break_minutes}m</p>}
                  {e.notes && <p className="text-foreground/70 italic">Note: {e.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OverviewReport({ profileId, userId, date, timezone, userName }: { profileId: string; userId: string | null; date: Date; timezone: string; userName: string }) {
  const { data: perf, isLoading } = useUserPerformance(profileId, userId, date);
  const { data: report } = useDetailedActivityReport(userId, date);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>;
  if (!perf) return <p className="text-sm text-muted-foreground p-4">No data available.</p>;

  const copyAll = () => {
    const lines = [
      `📋 Overview Report — ${userName}`,
      `Date: ${formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}`,
      `Status: ${perf.clockedIn ? "Clocked In" : "Not Clocked In"}`,
      `Hours Today: ${perf.hoursToday}`,
      `Activities: ${perf.activitiesToday}`,
      `AI Sessions: ${perf.aiSessionsToday}`,
      `Emails Sent: ${perf.emailsSent}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Overview report copied");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {formatDateInTimezone(date, timezone, { year: "numeric", month: "long", day: "numeric" })}
        </p>
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy Report
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Status", value: perf.clockedIn ? "🟢 Clocked In" : "⚪ Off Clock" },
          { label: "Hours Today", value: `${perf.hoursToday}h` },
          { label: "Activities", value: String(perf.activitiesToday) },
          { label: "AI Sessions", value: String(perf.aiSessionsToday) },
          { label: "Emails Sent", value: String(perf.emailsSent) },
          { label: "Clock Entries", value: String(perf.clockEntries.length) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {report && report.byEventType.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Activity Breakdown</h4>
          <div className="space-y-1.5">
            {report.byEventType.slice(0, 10).map((b) => (
              <div key={b.eventType} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/20">
                <span className="text-foreground">{formatEventType(b.eventType)}</span>
                <span className="font-medium text-primary">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionConfig: Record<SectionType, { icon: React.ElementType; title: string }> = {
  activity: { icon: BarChart3, title: "System Performance — Detailed Report" },
  timeclock: { icon: Clock, title: "Time Clock — Detailed Report" },
  overview: { icon: Activity, title: "General Overview — Detailed Report" },
  team: { icon: Users, title: "Team — Detailed Report" },
};

export function SectionDetailReportDialog({
  sectionType,
  profileId,
  userId,
  userName,
  date,
  timezone,
}: Props) {
  const config = sectionConfig[sectionType];
  const Icon = config.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={`View detailed ${sectionType} report`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="w-5 h-5 text-primary" />
            {config.title} — {userName}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="pb-4">
            {sectionType === "activity" && (
              <ActivityReport userId={userId} date={date} timezone={timezone} userName={userName} />
            )}
            {sectionType === "timeclock" && (
              <TimeClockReport profileId={profileId} userId={userId} date={date} timezone={timezone} userName={userName} />
            )}
            {sectionType === "overview" && (
              <OverviewReport profileId={profileId} userId={userId} date={date} timezone={timezone} userName={userName} />
            )}
            {sectionType === "team" && (
              <ActivityReport userId={userId} date={date} timezone={timezone} userName={userName} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
