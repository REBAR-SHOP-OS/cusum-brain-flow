import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Brain, Zap, Loader2, AlertTriangle, Clock, Activity, Mail, Bot, Users, ClipboardList, LogIn, LogOut, CalendarIcon, FileText, FileBarChart, BarChart3, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVizzyMemory, VizzyMemoryEntry } from "@/hooks/useVizzyMemory";
import { Button } from "@/components/ui/button";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { formatDateInTimezone, getTimezoneLabel } from "@/lib/dateConfig";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { useUserAgentSessions, AgentSessionSummary } from "@/hooks/useUserAgentSessions";
import { useUserActivityLog, ActivityEvent } from "@/hooks/useUserActivityLog";
import { useTeamDailyActivity } from "@/hooks/useTeamDailyActivity";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { getVisibleAgents, getVisibleMenus, getUserPrimaryAgentKeyFromConfig } from "@/lib/userAccessConfig";
import { useAuth } from "@/lib/auth";
import { Bot as BotIcon } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onClose: () => void;
}

const SIDEBAR_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: "dashboard",    label: "📊 Dashboard",       categories: ["brain_insight", "general", "benchmark", "daily_benchmark"] },
  { key: "inbox",        label: "📥 Inbox",            categories: ["email"] },
  { key: "team_hub",     label: "💬 Team Hub",         categories: ["feedback_clarification", "feedback_patch"] },
  { key: "tasks",        label: "📋 Business Tasks",   categories: ["auto_fix", "feedback_fix"] },
  { key: "monitor",      label: "📡 Live Monitor",     categories: ["agent_audit", "pre_digest"] },
  { key: "ceo",          label: "🏢 CEO Portal",       categories: ["business"] },
  { key: "support",      label: "🎧 Support",          categories: ["feedback_escalation", "call_summary", "voicemail_summary"] },
  { key: "pipeline",     label: "📈 Pipeline",         categories: ["leads"] },
  { key: "lead_scoring", label: "🎯 Lead Scoring",     categories: ["lead_scoring"] },
  { key: "customers",    label: "👥 Customers",        categories: ["crm"] },
  { key: "accounting",   label: "💰 Accounting",       categories: ["accounting"] },
  { key: "sales",        label: "🛒 Sales",            categories: ["sales", "orders"] },
  { key: "production",   label: "🏭 Production",       categories: ["production"] },
  { key: "shop_floor",   label: "🔧 Shop Floor",       categories: ["shop_floor"] },
  { key: "timeclock",    label: "⏰ Time Clock",       categories: ["timeclock"] },
  { key: "office_tools", label: "🛠️ Office Tools",     categories: ["office_tools"] },
];

/** Maps each SIDEBAR_GROUP key to the MenuKey required to see it */
const GROUP_TO_MENU: Record<string, string> = {
  dashboard: "Dashboard",
  inbox: "Inbox",
  team_hub: "Team Hub",
  tasks: "Business Tasks",
  monitor: "Live Monitor",
  ceo: "CEO Portal",
  support: "Support",
  pipeline: "Pipeline",
  lead_scoring: "Lead Scoring",
  customers: "Customers",
  accounting: "Accounting",
  sales: "Sales",
  production: "Shop Floor",
  shop_floor: "Shop Floor",
  timeclock: "Time Clock",
  office_tools: "Office Tools",
};
function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = formatDateInTimezone(now, timezone, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const tzShort = getTimezoneLabel(timezone);
  const abbr = tzShort.match(/\(([^)]+)\)/)?.[1] ?? "";

  return <span>{timeStr}{abbr ? ` ${abbr}` : ""}</span>;
}


const CATEGORY_TO_GROUP: Record<string, string> = {};
for (const g of SIDEBAR_GROUPS) {
  for (const c of g.categories) {
    CATEGORY_TO_GROUP[c] = g.key;
  }
}

function getDateKey(dateStr: string) {
  return format(new Date(dateStr), "yyyy-MM-dd");
}

function getDateLabel(dateStr: string) {
  return format(new Date(dateStr), "MMM d, yyyy");
}

function MemoryCard({ entry }: { entry: VizzyMemoryEntry }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <span className="text-[10px] text-muted-foreground">
        {entry.metadata?.report_date
          ? `📅 ${entry.metadata.report_date}`
          : format(new Date(entry.created_at), "MMM d, yyyy • HH:mm")}
      </span>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {entry.content}
      </p>
    </div>
  );
}

function DateGroupedEntries({ items }: { items: VizzyMemoryEntry[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, VizzyMemoryEntry[]> = {};
    for (const e of items) {
      const key = getDateKey(e.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  if (grouped.length <= 1) {
    return (
      <div className="space-y-2 pt-1">
        {items.map((entry) => (
          <MemoryCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {grouped.map(([dateKey, entries]) => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              {getDateLabel(entries[0].created_at)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {entries.map((entry) => (
              <MemoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Performance summary card for selected user */
function PerformanceCard({ profileId, userId, name, timezone, date }: { profileId: string; userId: string | null; name: string; timezone: string; date?: Date }) {
  const { data, isLoading } = useUserPerformance(profileId, userId, date);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }
  if (!data) return null;

  const clockInLabel = data.clockedIn && data.clockInTime
    ? formatDateInTimezone(new Date(data.clockInTime), timezone, { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{name}'s Performance</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">
            {data.clockedIn ? `In: ${clockInLabel}` : "Not clocked in"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Hours: {data.hoursToday}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Activities: {data.activitiesToday}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">AI: {data.aiSessionsToday}</span>
        </div>
      </div>
    </div>
  );
}

/** Agent sessions accordion for selected user */
function UserAgentsSections({ userId, name, email }: { userId: string; name: string; email?: string }) {
  const { data: sessionAgents, isLoading } = useUserAgentSessions(userId);

  // Build merged list: accessible agents + any additional agents from sessions
  const mergedAgents = React.useMemo(() => {
    const result: Array<{
      agentName: string;
      agentRole: string;
      isAssigned: boolean;
      hasAccess: boolean;
      sessionCount: number;
      totalMessages: number;
      lastUsed: string;
      recentMessages: { role: string; content: string; created_at: string }[];
    }> = [];

    // Use centralized email-based config
    const accessibleKeys = getVisibleAgents(email);
    const primaryKey = getUserPrimaryAgentKeyFromConfig(email);

    // Add all accessible agents (primary first)
    const orderedKeys = primaryKey
      ? [primaryKey, ...accessibleKeys.filter((k) => k !== primaryKey)]
      : accessibleKeys;

    const addedNames = new Set<string>();

    for (const key of orderedKeys) {
      const config = agentConfigs[key];
      if (!config) continue;
      const nameLower = config.name.toLowerCase();
      if (addedNames.has(nameLower)) continue;
      addedNames.add(nameLower);

      const sessionData = sessionAgents?.find(
        (s) => s.agentName.toLowerCase() === nameLower
      );
      result.push({
        agentName: config.name,
        agentRole: config.role,
        isAssigned: key === primaryKey,
        hasAccess: true,
        sessionCount: sessionData?.sessionCount ?? 0,
        totalMessages: sessionData?.totalMessages ?? 0,
        lastUsed: sessionData?.lastUsed ?? "",
        recentMessages: sessionData?.recentMessages ?? [],
      });
    }

    // Add any other agents from sessions that aren't already listed
    for (const s of sessionAgents ?? []) {
      if (!addedNames.has(s.agentName.toLowerCase())) {
        addedNames.add(s.agentName.toLowerCase());
        result.push({
          agentName: s.agentName,
          agentRole: "",
          isAssigned: false,
          hasAccess: false,
          sessionCount: s.sessionCount,
          totalMessages: s.totalMessages,
          lastUsed: s.lastUsed,
          recentMessages: s.recentMessages,
        });
      }
    }

    return result;
  }, [email, sessionAgents]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading agents...</span>
      </div>
    );
  }

  if (!mergedAgents.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
        <span className="text-xs text-muted-foreground italic">No agents assigned</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Accordion type="multiple" className="w-full space-y-1">
        {mergedAgents.map((agent) => (
          <AccordionItem
            key={agent.agentName}
            value={`agent-${agent.agentName}`}
            className="border border-border rounded-lg px-3"
          >
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                🤖 {agent.agentName}
                {agent.agentRole && (
                  <span className="text-[10px] text-muted-foreground font-normal">— {agent.agentRole}</span>
                )}
                {agent.isAssigned && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Primary</span>
                )}
                {!agent.isAssigned && agent.hasAccess && (
                  <span className="text-[9px] bg-accent/50 text-accent-foreground px-1.5 py-0.5 rounded-full font-medium">Access</span>
                )}
                {agent.sessionCount > 0 ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({agent.sessionCount} session{agent.sessionCount !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-normal italic">No activity yet</span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-1">
                {agent.sessionCount > 0 ? (
                  <>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5 mb-2">
                      <span>Sessions: <strong className="text-foreground">{agent.sessionCount}</strong></span>
                      <span>Messages: <strong className="text-foreground">{agent.totalMessages}</strong></span>
                      {agent.lastUsed && (
                        <span>Last active: <strong className="text-foreground">{format(new Date(agent.lastUsed), "MMM d, h:mm a")}</strong></span>
                      )}
                    </div>
                    {agent.recentMessages.map((msg, i) => (
                      <div key={i} className="rounded border border-border bg-card p-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-semibold ${msg.role === "user" ? "text-primary" : "text-muted-foreground"}`}>
                            {msg.role === "user" ? "👤 User" : `🤖 ${agent.agentName}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(msg.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs text-foreground line-clamp-3">{msg.content}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-3">No activity with this agent yet</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
/** Report copy button for section headers */
function SectionReportButton({ label, getText }: { label: string; getText: () => string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(getText());
        sonnerToast.success(`${label} report copied to clipboard`);
      }}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title={`Copy ${label} report`}
    >
      <ClipboardList className="w-3.5 h-3.5" />
    </button>
  );
}

/** PDF generation button for the General Report header */
function GeneralReportPDFButton({ date }: { date: Date }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    sonnerToast.info("Generating full daily report PDF…");

    try {
      const dateStr = date.toISOString().split("T")[0];
      const { data, error } = await supabase.functions.invoke("generate-daily-report-pdf", {
        body: { date: dateStr },
      });

      if (error) throw new Error(error.message || "Failed to generate report");
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No download URL returned");

      window.open(data.url, "_blank");
      sonnerToast.success("Report generated — opening in new tab");
    } catch (err: any) {
      console.error("Report generation failed:", err);
      sonnerToast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      title="Generate full daily report PDF"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
    </button>
  );
}


/** Comprehensive user report button — aggregates all performance data */
function UserFullReportButton({
  profile,
  timezone,
  date,
}: {
  profile: { id: string; user_id: string; full_name: string | null; email: string | null };
  timezone: string;
  date?: Date;
}) {
  const { data: perfData } = useUserPerformance(profile.id, profile.user_id, date);
  const { data: agentSessions } = useUserAgentSessions(profile.user_id);
  const { data: activities } = useUserActivityLog(profile.id);

  const generateReport = () => {
    const name = profile.full_name || "User";
    const dateLabel = date ? format(date, "MMM d, yyyy") : format(new Date(), "MMM d, yyyy");
    const lines: string[] = [];

    lines.push(`📊 Full Performance Report — ${name}`);
    lines.push(`📅 Date: ${dateLabel}`);
    lines.push(`📧 Email: ${profile.email || "N/A"}`);
    lines.push("");

    // Performance overview
    lines.push("── General Overview ──");
    if (perfData) {
      lines.push(`⏰ Status: ${perfData.clockedIn ? "Clocked In" : "Not Clocked In"}`);
      lines.push(`🕐 Hours Worked: ${perfData.hoursToday}h`);
      lines.push(`📋 Activities: ${perfData.activitiesToday}`);
      lines.push(`🤖 AI Sessions: ${perfData.aiSessionsToday}`);
      lines.push(`📧 Emails Sent: ${perfData.emailsSent}`);
      if (perfData.clockEntries?.length) {
        lines.push("");
        lines.push("Clock Entries:");
        for (const entry of perfData.clockEntries) {
          const start = formatDateInTimezone(new Date(entry.clock_in), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
          const end = entry.clock_out
            ? formatDateInTimezone(new Date(entry.clock_out), timezone, { hour: "numeric", minute: "2-digit", hour12: true })
            : "Still working";
          lines.push(`  • ${start} → ${end}`);
        }
      }
    } else {
      lines.push("No performance data available.");
    }

    lines.push("");

    // Agents
    lines.push("── Agent Usage ──");
    if (agentSessions?.length) {
      for (const agent of agentSessions) {
        const lastUsed = agent.lastUsed ? format(new Date(agent.lastUsed), "MMM d, yyyy") : "N/A";
        lines.push(`  🤖 ${agent.agentName}: ${agent.sessionCount} sessions, ${agent.totalMessages} messages (last: ${lastUsed})`);
      }
    } else {
      lines.push("  No agent sessions recorded.");
    }

    lines.push("");

    // Activity log
    lines.push("── Activity Log (Today) ──");
    if (activities?.length) {
      for (const a of activities.slice(0, 20)) {
        const time = formatDateInTimezone(new Date(a.created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
        lines.push(`  • [${time}] ${a.event_type} — ${a.entity_type}${a.description ? `: ${a.description}` : ""}`);
      }
      if (activities.length > 20) {
        lines.push(`  ... and ${activities.length - 20} more`);
      }
    } else {
      lines.push("  No activities recorded today.");
    }

    return lines.join("\n");
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(generateReport());
        sonnerToast.success("Full user report copied to clipboard");
      }}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Generate full user report"
    >
      <FileText className="w-3.5 h-3.5" />
    </button>
  );
}

/** Activity log section for selected user */
function UserActivitySection({ profileId, timezone }: { profileId: string; timezone: string }) {
  const { data: activities, isLoading } = useUserActivityLog(profileId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading activities...</span>
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
        <span className="text-xs text-muted-foreground italic">No activities recorded today</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-60 overflow-y-auto">
      {activities.map((a) => (
        <div key={a.id} className="flex items-start gap-2 rounded border border-border bg-card p-2">
          <Activity className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">{a.event_type}</span>
              <span>·</span>
              <span>{a.entity_type}</span>
              <span className="ml-auto">
                {formatDateInTimezone(new Date(a.created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
              </span>
            </div>
            {a.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Time clock detail section for selected user */
function UserTimeClockSection({ profileId, userId, timezone }: { profileId: string; userId: string | null; timezone: string }) {
  const { data } = useUserPerformance(profileId, userId);

  if (!data?.clockEntries?.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
        <span className="text-xs text-muted-foreground italic">No clock entries today</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {data.clockEntries.map((entry, i) => {
        const start = new Date(entry.clock_in);
        const end = entry.clock_out ? new Date(entry.clock_out) : null;
        const durationMs = (end?.getTime() ?? Date.now()) - start.getTime();
        const durationH = Math.round((durationMs / 3600000) * 10) / 10;

        return (
          <div key={i} className="flex items-center gap-3 rounded border border-border bg-card p-2.5 text-xs">
            <LogIn className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <span className="text-foreground font-medium">
              {formatDateInTimezone(start, timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
            </span>
            <span className="text-muted-foreground">→</span>
            {end ? (
              <>
                <LogOut className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-foreground font-medium">
                  {formatDateInTimezone(end, timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
                </span>
              </>
            ) : (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Still working</span>
            )}
            <span className="ml-auto text-muted-foreground">{durationH}h</span>
          </div>
        );
      })}
    </div>
  );
}
/** Team Daily Report for "All" view */
function TeamDailyReport({
  profiles,
  timezone,
}: {
  profiles: { id: string; full_name: string; email?: string; user_id: string | null }[];
  timezone: string;
}) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const profileSlims = useMemo(() => profiles.map((p) => ({ id: p.id, user_id: p.user_id })), [profiles]);
  const { data, isLoading } = useTeamDailyActivity(profileSlims, selectedDate);

  const isToday = useMemo(() => {
    const now = new Date();
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    );
  }, [selectedDate]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading team report...</span>
      </div>
    );
  }

  if (!data) return null;

  const sorted = [...profiles].sort((a, b) => {
    const aCount = data[a.id]?.activities.length ?? 0;
    const bCount = data[b.id]?.activities.length ?? 0;
    return bCount - aCount;
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground flex-1">
          Team Daily Report
          {!isToday && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {format(selectedDate, "MMM d, yyyy")}
            </span>
          )}
        </h3>
        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 text-primary"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        )}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Select date">
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[100001]" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  setSelectedDate(d);
                  setCalendarOpen(false);
                }
              }}
              disabled={(d) => d > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <SectionReportButton
          label="Team"
          getText={() => {
            const lines = sorted.map((p) => {
              const d = data[p.id];
              const actCount = d?.activities.length ?? 0;
              const clockIn = d?.clockEntries?.[d.clockEntries.length - 1]?.clock_in;
              const clockLabel = clockIn
                ? formatDateInTimezone(new Date(clockIn), timezone, { hour: "numeric", minute: "2-digit", hour12: true })
                : "Not clocked in";
              return `${p.full_name}: ${actCount} activities, Clock: ${clockLabel}`;
            });
            return `👥 Team Daily Report\n${lines.join("\n")}`;
          }}
        />
      </div>
      <div className="p-3">
        <Accordion type="multiple" className="w-full space-y-1">
          {sorted.map((p) => {
            const d = data[p.id];
            const activities = d?.activities ?? [];
            const clockEntries = d?.clockEntries ?? [];
            const firstName = p.full_name?.split(" ")[0] || "User";
            const firstClock = clockEntries.length > 0 ? clockEntries[clockEntries.length - 1] : null;
            const lastClock = clockEntries.length > 0 ? clockEntries[0] : null;

            return (
              <AccordionItem
                key={p.id}
                value={`team-${p.id}`}
                className="border border-border rounded-lg px-3"
              >
                <AccordionTrigger className="text-sm font-medium hover:no-underline">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                    <span>{firstName}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({activities.length} activit{activities.length !== 1 ? "ies" : "y"})
                    </span>
                  </span>
                  <SectionReportButton
                    label={firstName}
                    getText={() => {
                      const dateStr = formatDateInTimezone(selectedDate, timezone, { month: "long", day: "numeric", year: "numeric" });

                      // Time clock section
                      let clockSection = "⏰ TIME CLOCK\n";
                      let totalMinutes = 0;
                      if (clockEntries.length > 0) {
                        for (const ce of clockEntries) {
                          const inTime = formatDateInTimezone(new Date(ce.clock_in), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
                          const outTime = ce.clock_out
                            ? formatDateInTimezone(new Date(ce.clock_out), timezone, { hour: "numeric", minute: "2-digit", hour12: true })
                            : "Still working";
                          const startMs = new Date(ce.clock_in).getTime();
                          const endMs = ce.clock_out ? new Date(ce.clock_out).getTime() : Date.now();
                          totalMinutes += (endMs - startMs) / 60000;
                          clockSection += `• ${inTime} → ${outTime}\n`;
                        }
                        const hrs = Math.floor(totalMinutes / 60);
                        const mins = Math.round(totalMinutes % 60);
                        clockSection += `• Total hours: ${hrs}h ${mins}m\n`;
                      } else {
                        clockSection += "• Not clocked in today\n";
                      }

                      // Activity breakdown by entity_type
                      const breakdown: Record<string, number> = {};
                      for (const a of activities) {
                        breakdown[a.entity_type] = (breakdown[a.entity_type] || 0) + 1;
                      }
                      let breakdownSection = "📊 ACTIVITY BREAKDOWN\n";
                      const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
                      for (const [type, count] of sorted) {
                        breakdownSection += `• ${type}: ${count} event${count !== 1 ? "s" : ""}\n`;
                      }

                      // Activity timeline
                      let timelineSection = `📝 ACTIVITY LOG (${activities.length} events)\n`;
                      for (const a of activities) {
                        const t = formatDateInTimezone(new Date(a.created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
                        timelineSection += `• ${t} — ${a.event_type} · ${a.entity_type}${a.description ? `: ${a.description}` : ""}\n`;
                      }

                      // Summary stats
                      let summarySection = "";
                      if (activities.length > 0) {
                        const firstAct = formatDateInTimezone(new Date(activities[activities.length - 1].created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
                        const lastAct = formatDateInTimezone(new Date(activities[0].created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true });
                        summarySection = `📈 SUMMARY\n• First activity: ${firstAct}\n• Last activity: ${lastAct}\n• Total activities: ${activities.length}\n`;
                      }

                      return `📋 DAILY PERFORMANCE REPORT — ${p.full_name}\nDate: ${dateStr} | Total Activities: ${activities.length}\n\n${clockSection}\n${breakdownSection}\n${timelineSection}\n${summarySection}`.trim();
                    }}
                  />
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {firstClock ? (
                        <span>
                          {formatDateInTimezone(new Date(firstClock.clock_in), timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
                          {" → "}
                          {lastClock?.clock_out ? (
                            formatDateInTimezone(new Date(lastClock.clock_out), timezone, { hour: "numeric", minute: "2-digit", hour12: true })
                          ) : (
                            <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Still working</span>
                          )}
                        </span>
                      ) : (
                        <span className="italic">Not clocked in today</span>
                      )}
                    </div>
                    {activities.length > 0 ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {activities.map((a) => (
                          <div key={a.id} className="flex items-start gap-2 rounded border border-border bg-card p-2">
                            <Activity className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-medium text-foreground">{a.event_type}</span>
                                <span>·</span>
                                <span>{a.entity_type}</span>
                                <span className="ml-auto">
                                  {formatDateInTimezone(new Date(a.created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
                                </span>
                              </div>
                              {a.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-2">No activities today</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}


export function VizzyBrainPanel({ onClose }: Props) {
  const { entries, isLoading, error, isCompanyLoading, hasCompanyContext, analyzeSystem } = useVizzyMemory();
  const { user } = useAuth();
  const { timezone } = useWorkspaceSettings();
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [userSelectedDate, setUserSelectedDate] = useState<Date>(new Date());
  const [userCalendarOpen, setUserCalendarOpen] = useState(false);
  const isUserToday = userSelectedDate.toDateString() === new Date().toDateString();

  // Filter @rebar.shop profiles, active first
  const rebarProfiles = useMemo(() => {
    return profiles
      .filter((p) => p.email?.endsWith("@rebar.shop"))
      .sort((a, b) => {
        if (a.is_active === b.is_active) return a.full_name.localeCompare(b.full_name);
        return a.is_active ? -1 : 1;
      });
  }, [profiles]);

  const selectedProfile = rebarProfiles.find((p) => p.id === selectedProfileId);

  // Filter entries by selected user name if applicable
  const filteredEntries = useMemo(() => {
    if (!selectedProfile) return entries;
    const firstName = selectedProfile.full_name?.split(" ")[0]?.toLowerCase();
    const fullName = selectedProfile.full_name?.toLowerCase();
    const email = selectedProfile.email?.toLowerCase();
    if (!firstName) return entries;
    return entries.filter((e) => {
      const c = e.content.toLowerCase();
      return c.includes(firstName) || (fullName && c.includes(fullName)) || (email && c.includes(email));
    });
  }, [entries, selectedProfile]);

  const grouped = useMemo(() => {
    const map: Record<string, VizzyMemoryEntry[]> = {};
    for (const e of filteredEntries) {
      const groupKey = CATEGORY_TO_GROUP[e.category] || "dashboard";
      if (!map[groupKey]) map[groupKey] = [];
      map[groupKey].push(e);
    }
    return SIDEBAR_GROUPS.map((g) => ({ key: g.key, label: g.label, items: map[g.key] || [] }));
  }, [filteredEntries]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const count = await analyzeSystem();
      toast({ title: `🧠 ${count} insight(s) added` });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const renderContent = () => {
    if (isLoading || isCompanyLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      );
    }

    if (!hasCompanyContext) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50 text-warning" />
          <p className="text-sm font-medium">Company profile not found</p>
          <p className="text-xs mt-1">Your account may not be linked to a company yet.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50 text-destructive" />
          <p className="text-sm font-medium">Failed to load memories</p>
          <p className="text-xs mt-1">{(error as Error).message}</p>
        </div>
      );
    }

    // Filter sections by the SELECTED user's menu access (or viewer's if "All")
    const targetEmail = selectedProfile?.email ?? user?.email;
    const userMenus = getVisibleMenus(targetEmail);
    const accessibleGroups = grouped.filter((group) => {
      const requiredMenu = GROUP_TO_MENU[group.key];
      if (!requiredMenu) return true; // no mapping = always show
      return userMenus.includes(requiredMenu);
    });

    const sectionsToShow = accessibleGroups;

    if (selectedProfile && sectionsToShow.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm font-medium">No activity found</p>
          <p className="text-xs mt-1">This user has no recorded entries in any section.</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
          <FileBarChart className="w-4 h-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground flex-1">General Report</h3>
          <GeneralReportPDFButton date={userSelectedDate} />
        </div>
        <div className="p-3">
          <Accordion type="multiple" className="w-full space-y-1">
            {sectionsToShow.map((group) => (
              <AccordionItem key={group.key} value={group.key} className="border border-border rounded-lg px-3">
                <AccordionTrigger className="text-base font-medium hover:no-underline">
                  <span className="flex items-center gap-2">
                    {group.label}
                    <span className="text-sm text-muted-foreground font-normal">({group.items.length})</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <DateGroupedEntries items={group.items} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-5xl max-h-[92vh] mx-4 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Vizzy Brain</h2>
            <span className="text-sm text-muted-foreground">({filteredEntries.length})</span>
            <span className="text-muted-foreground/50 mx-1">|</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <LiveClock timezone={timezone} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !hasCompanyContext} className="gap-1">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {analyzing ? "Analyzing..." : "Analyze Now"}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User avatar bar */}
        {rebarProfiles.length > 0 && (
          <div className="px-5 py-4 border-b border-border flex items-center gap-4 overflow-x-auto">
            <button
              onClick={() => setSelectedProfileId(null)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-base font-semibold transition-colors ${
                !selectedProfileId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {rebarProfiles.map((p) => {
              const initial = p.full_name?.charAt(0)?.toUpperCase() || "?";
              const firstName = p.full_name?.split(" ")[0] || "?";
              const isSelected = selectedProfileId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProfileId(isSelected ? null : p.id); setUserSelectedDate(new Date()); }}
                  className={`shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-full text-base transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                      : "bg-muted hover:bg-muted/80"
                  } ${!p.is_active ? "opacity-50" : ""}`}
                  title={`${p.full_name} (${p.email})`}
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    {initial}
                  </span>
                  <span className="text-base font-bold">{firstName}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {!selectedProfile && rebarProfiles.length > 0 && (
            <TeamDailyReport
              profiles={rebarProfiles.filter((p) => p.email !== "ai@rebar.shop")}
              timezone={timezone}
            />
          )}
          {selectedProfile && (
            <div className="space-y-4">
              {/* Section 1: General Overview */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-semibold text-foreground flex-1">
                    General Overview
                    {!isUserToday && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({format(userSelectedDate, "MMM d, yyyy")})
                      </span>
                    )}
                  </h3>
                  <Popover open={userCalendarOpen} onOpenChange={setUserCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted transition-colors" title="Select date">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100001]" align="end">
                      <Calendar
                        mode="single"
                        selected={userSelectedDate}
                        onSelect={(d) => { if (d) setUserSelectedDate(d); setUserCalendarOpen(false); }}
                        disabled={(d) => d > new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {!isUserToday && (
                    <button
                      onClick={() => setUserSelectedDate(new Date())}
                      className="text-xs text-primary hover:underline"
                    >
                      Today
                    </button>
                  )}
                  <SectionReportButton
                    label="Overview"
                    getText={() => {
                      const name = selectedProfile.full_name || "User";
                      return `📊 General Overview — ${name}\nEmail: ${selectedProfile.email}\nStatus: ${selectedProfile.is_active ? "Active" : "Inactive"}`;
                    }}
                  />
                </div>
                <div className="p-3">
                  <PerformanceCard
                    profileId={selectedProfile.id}
                    userId={selectedProfile.user_id}
                    name={selectedProfile.full_name?.split(" ")[0] || "User"}
                    timezone={timezone}
                    date={userSelectedDate}
                  />
                </div>
              </div>

              {/* Section 2: Agents */}
              {selectedProfile.user_id && selectedProfile.email !== "ai@rebar.shop" && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                    <BotIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground flex-1">Agents</h3>
                    <UserFullReportButton
                      profile={selectedProfile}
                      timezone={timezone}
                      date={userSelectedDate}
                    />
                  </div>
                  <div className="p-3">
                    <UserAgentsSections
                      userId={selectedProfile.user_id}
                      name={selectedProfile.full_name?.split(" ")[0] || "User"}
                      email={selectedProfile.email}
                    />
                  </div>
                </div>
              )}

              {/* Section 3: System Performance Overview */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground flex-1">System Performance Overview</h3>
                  <SectionReportButton
                    label="System Performance"
                    getText={() => `📊 System Performance Overview — ${selectedProfile.full_name || "User"}\nToday's system activities.`}
                  />
                </div>
                <div className="p-3">
                  <UserActivitySection profileId={selectedProfile.id} timezone={timezone} />
                </div>
              </div>

              {/* Section 4: Time Clock Detail */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground flex-1">Time Clock</h3>
                  <SectionReportButton
                    label="Time Clock"
                    getText={() => `⏰ Time Clock — ${selectedProfile.full_name || "User"}\nDetailed clock-in/clock-out entries for today.`}
                  />
                </div>
                <div className="p-3">
                  <UserTimeClockSection profileId={selectedProfile.id} userId={selectedProfile.user_id} timezone={timezone} />
                </div>
              </div>
            </div>
          )}
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  );
}
