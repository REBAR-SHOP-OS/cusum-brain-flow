import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Brain, Zap, Loader2, AlertTriangle, Clock, Activity, Mail, Bot, Users, ClipboardList, LogIn, LogOut, CalendarIcon, FileText, FileBarChart, BarChart3, Download, Pencil, Plus, XCircle, Check, Globe, Database, ChevronDown, Copy, Sparkles } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVizzyMemory, VizzyMemoryEntry } from "@/hooks/useVizzyMemory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { SectionDetailReportDialog } from "@/components/vizzy/SectionDetailReport";
import { format } from "date-fns";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { formatDateInTimezone, getTimezoneLabel } from "@/lib/dateConfig";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { useUserAgentSessions, AgentSessionSummary } from "@/hooks/useUserAgentSessions";
import { useSystemAgentSessions, SystemAgentSummary } from "@/hooks/useSystemAgentSessions";
import { useAgentDomainStats, AgentDomainStat } from "@/hooks/useAgentDomainStats";
import { useUserActivityLog, ActivityEvent } from "@/hooks/useUserActivityLog";
import { useTeamDailyActivity } from "@/hooks/useTeamDailyActivity";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { getVisibleAgents, getVisibleMenus, getUserPrimaryAgentKeyFromConfig, ALL_MENUS } from "@/lib/userAccessConfig";
import { useAuth } from "@/lib/auth";
import { Bot as BotIcon } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEagerReportPersistence } from "@/hooks/useEagerReportPersistence";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { defaultAutomations, ADMIN_ONLY_IDS } from "@/components/integrations/AutomationsSection";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";
import { Cog } from "lucide-react";
import { useUserAccessOverrides } from "@/hooks/useUserAccessOverrides";
import { Checkbox } from "@/components/ui/checkbox";

const USER_AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500",
  "bg-cyan-500", "bg-indigo-500",
];
function getUserAvatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return USER_AVATAR_COLORS[Math.abs(hash) % USER_AVATAR_COLORS.length];
}

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
function UserAgentsSections({ userId, name, email, overrideAgents, onEditAgents, canEdit, date }: {
  userId: string; name: string; email?: string;
  overrideAgents?: string[] | null;
  onEditAgents?: () => void;
  canEdit?: boolean;
  date?: Date;
}) {
  const { data: sessionAgents, isLoading } = useUserAgentSessions(userId, date);

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

    // Use DB overrides if present, else fallback to hardcoded config
    const accessibleKeys = overrideAgents && overrideAgents.length > 0
      ? overrideAgents
      : getVisibleAgents(email);
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
  }, [email, sessionAgents, overrideAgents]);

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
        {canEdit && onEditAgents && (
          <button onClick={onEditAgents} className="ml-2 text-primary text-xs hover:underline">+ Add agents</button>
        )}
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

/** PDF generation button for per-user comprehensive report */
function GeneralReportPDFButton({ date, userId, userName }: { date: Date; userId?: string; userName?: string }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    sonnerToast.info(`Generating report for ${userName || "user"}…`);

    try {
      const dateStr = date.toISOString().split("T")[0];
      const data = await invokeEdgeFunction("generate-daily-report-pdf", {
        date: dateStr, targetUserId: userId, targetUserName: userName,
      }, { timeoutMs: 90000 });

      if (data?.error) throw new Error(data.error);
      if (!data?.html) throw new Error("No report content returned");

      // Convert HTML to PDF via hidden iframe + html2canvas + jsPDF
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "794px"; // A4 width at 96dpi
      iframe.style.height = "1123px";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Cannot access iframe document");
      iframeDoc.open();
      iframeDoc.write(data.html);
      iframeDoc.close();

      // Wait for fonts/images to load
      await new Promise(r => setTimeout(r, 800));

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 794,
        windowWidth: 794,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = 210; // A4 mm
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      const pdf = new jsPDF("p", "mm", "a4");
      let position = 0;
      let remaining = scaledHeight;

      // Multi-page support
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, scaledHeight);
      remaining -= pdfHeight;

      while (remaining > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, scaledHeight);
        remaining -= pdfHeight;
      }

      const safeName = (userName || "user").replace(/\s+/g, "-");
      const dateStr2 = date.toISOString().split("T")[0];
      pdf.save(`report-${safeName}-${dateStr2}.pdf`);
      sonnerToast.success("PDF دانلود شد");
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
      className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
      title={`Generate comprehensive report for ${userName || "user"}`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-destructive" /> : <Download className="w-5 h-5 text-destructive" />}
    </button>
  );
}

/** Automations visible to a user based on their role */
function UserAutomationsSection({ email, overrideAutomations, onEditAutomations, canEdit }: {
  email: string;
  overrideAutomations?: string[] | null;
  onEditAutomations?: () => void;
  canEdit?: boolean;
}) {
  const normalizedEmail = email.toLowerCase();
  const isSuperAdmin = ACCESS_POLICIES.superAdmins.includes(normalizedEmail);

  const visibleAutomations = useMemo(() => {
    // If DB override exists, use that
    if (overrideAutomations && overrideAutomations.length > 0) {
      return defaultAutomations.filter((a) => overrideAutomations.includes(a.id));
    }
    // Fallback to hardcoded logic
    if (isSuperAdmin) return defaultAutomations;
    const extraAllowed = normalizedEmail === "zahra@rebar.shop"
      ? new Set(["social-media-manager"])
      : new Set<string>();
    return defaultAutomations.filter(
      (a) => !ADMIN_ONLY_IDS.has(a.id) || extraAllowed.has(a.id)
    );
  }, [normalizedEmail, isSuperAdmin, overrideAutomations]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
        <Cog className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground flex-1">Automations</h3>
        <span className="text-[10px] text-muted-foreground">{visibleAutomations.length} active</span>
        {canEdit && onEditAutomations && (
          <button
            onClick={onEditAutomations}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit automations"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-3">
        {visibleAutomations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No automations assigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visibleAutomations.map((a) => (
              <span
                key={a.id}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
              >
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const { data: agentSessions } = useUserAgentSessions(profile.user_id, date);
  const { data: activities } = useUserActivityLog(profile.id, null, date);

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

  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!reportText) return;
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    sonnerToast.success("Report copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setReportText(generateReport());
        }}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Generate full user report"
      >
        <FileText className="w-3.5 h-3.5" />
      </button>

      <Dialog open={!!reportText} onOpenChange={(open) => { if (!open) setReportText(null); }}>
        <DialogContent className="max-w-2xl w-full flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              📊 Full Report — {profile.full_name || "User"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 rounded-md border border-border bg-muted/30 p-4">
            <pre className="text-[12px] leading-6 font-mono text-foreground whitespace-pre-wrap break-words">
              {reportText}
            </pre>
          </ScrollArea>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleCopy}>
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy to Clipboard</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Human-readable event label mapping */
function humanLabel(eventType: string, description?: string | null): string {
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

/** Category for grouping */
function getCategory(eventType: string, entityType: string): string {
  if (eventType === "page_visit") return "pages";
  if (eventType.startsWith("email") || entityType === "email") return "emails";
  if (eventType.includes("agent") || entityType === "agent") return "ai";
  return "mutations";
}

const categoryConfig: Record<string, { label: string; color: string; icon: typeof Activity }> = {
  pages: { label: "Pages Visited", color: "text-blue-400", icon: Globe },
  emails: { label: "Emails", color: "text-green-400", icon: Mail },
  mutations: { label: "Data Actions", color: "text-orange-400", icon: Database },
  ai: { label: "AI & Agent", color: "text-purple-400", icon: Brain },
};

/** Activity log section for selected user — grouped & detailed */
function UserActivitySection({ profileId, userId, timezone, date }: { profileId: string; userId?: string; timezone: string; date?: Date }) {
  const { data: activities, isLoading } = useUserActivityLog(profileId, userId, date);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({ pages: true, emails: true, mutations: true, ai: true });

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

  // Group activities by category
  const grouped: Record<string, typeof activities> = { pages: [], emails: [], mutations: [], ai: [] };
  for (const a of activities) {
    const cat = getCategory(a.event_type, a.entity_type);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  }

  // Summary counts
  const pageCt = grouped.pages.length;
  const emailCt = grouped.emails.length;
  const mutCt = grouped.mutations.length;
  const aiCt = grouped.ai.length;

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-2">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-muted border border-border text-foreground font-medium">
          Total: {activities.length}
        </span>
        {pageCt > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Globe className="w-2.5 h-2.5" /> Pages: {pageCt}
          </span>
        )}
        {emailCt > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400">
            <Mail className="w-2.5 h-2.5" /> Emails: {emailCt}
          </span>
        )}
        {mutCt > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Database className="w-2.5 h-2.5" /> Actions: {mutCt}
          </span>
        )}
        {aiCt > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Brain className="w-2.5 h-2.5" /> AI: {aiCt}
          </span>
        )}
      </div>

      {/* Grouped sections */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {(["pages", "emails", "mutations", "ai"] as const).map((catKey) => {
          const items = grouped[catKey];
          if (!items?.length) return null;
          const cfg = categoryConfig[catKey];
          const CatIcon = cfg.icon;
          const isOpen = openGroups[catKey];

          return (
            <div key={catKey} className="rounded border border-border overflow-hidden">
              <button
                onClick={() => toggleGroup(catKey)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <CatIcon className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                <span className="text-xs font-medium text-foreground flex-1">{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{items.length}</span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="divide-y divide-border/50">
                  {items.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 px-2.5 py-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-foreground">{humanLabel(a.event_type, a.description)}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            {formatDateInTimezone(new Date(a.created_at), timezone, { hour: "numeric", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{a.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Time clock detail section for selected user */
function UserTimeClockSection({ profileId, userId, timezone, date }: { profileId: string; userId: string | null; timezone: string; date?: Date }) {
  const { data } = useUserPerformance(profileId, userId, date);

  if (!data?.clockEntries?.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
        <span className="text-xs text-muted-foreground italic">No clock entries for this day</span>
      </div>
    );
  }

  let totalGrossMin = 0;
  let totalBreakMin = 0;

  return (
    <div className="space-y-1.5">
      {data.clockEntries.map((entry, i) => {
        const start = new Date(entry.clock_in);
        const end = entry.clock_out ? new Date(entry.clock_out) : null;
        const durationMs = (end?.getTime() ?? Date.now()) - start.getTime();
        const grossMin = durationMs / 60000;
        const breakMin = entry.break_minutes ?? 0;
        const netMin = Math.max(0, grossMin - breakMin);
        totalGrossMin += grossMin;
        totalBreakMin += breakMin;
        const netH = Math.round((netMin / 60) * 10) / 10;

        return (
          <div key={i} className="rounded border border-border bg-card p-2.5">
            <div className="flex items-center gap-2 text-xs">
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
              {breakMin > 0 && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full">Break {breakMin}m</span>
              )}
              <span className="ml-auto text-muted-foreground font-medium">{netH}h</span>
            </div>
            {entry.notes && (
              <p className="mt-1 text-[10px] text-muted-foreground pl-5 italic">{entry.notes}</p>
            )}
          </div>
        );
      })}

      {/* Summary row */}
      <div className="flex items-center justify-between rounded border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium">
        <span className="text-foreground">Total</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Gross {Math.round((totalGrossMin / 60) * 10) / 10}h</span>
          {totalBreakMin > 0 && <span className="text-amber-600">Break {totalBreakMin}m</span>}
          <span className="text-primary">Net {Math.round(((totalGrossMin - totalBreakMin) / 60) * 10) / 10}h</span>
        </div>
      </div>
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
  useEagerReportPersistence(profiles, data, selectedDate, timezone);

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
        <SectionDetailReportDialog
          sectionType="team"
          profileId=""
          userId={null}
          userName="Team"
          date={selectedDate}
          timezone={timezone}
          teamProfiles={profiles}
          teamData={data}
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
                <div className="flex items-center">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline flex-1">
                    <span className="flex items-center gap-2 flex-1">
                      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {firstName.charAt(0).toUpperCase()}
                      </span>
                      <span>{firstName}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        ({activities.length} activit{activities.length !== 1 ? "ies" : "y"})
                      </span>
                      {d?.hoursToday != null && d.hoursToday > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />{d.hoursToday.toFixed(1)}h
                        </span>
                      )}
                      {d?.aiSessionsToday != null && d.aiSessionsToday > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />{d.aiSessionsToday}
                        </span>
                      )}
                      {d?.emailsSent != null && d.emailsSent > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Mail className="w-3 h-3" />{d.emailsSent}
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <SectionDetailReportDialog
                    sectionType="overview"
                    profileId={p.id}
                    userId={p.user_id || null}
                    userName={firstName}
                    date={selectedDate}
                    timezone={timezone}
                  />
                </div>
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


/** Checkbox editor popover for agents or automations */
function AccessEditorPopover({
  title,
  allItems,
  selectedIds,
  onSave,
  onClose: onPopoverClose,
}: {
  title: string;
  allItems: { id: string; label: string }[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full max-h-80 overflow-y-auto border-t border-border bg-muted/20 p-3 space-y-2 mt-2 rounded-b-xl">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { onSave(Array.from(selected)); onPopoverClose(); }}
            className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onPopoverClose} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {allItems.map((item) => (
        <label key={item.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
          <Checkbox
            checked={selected.has(item.id)}
            onCheckedChange={() => toggle(item.id)}
          />
          <span className="text-foreground">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── System-Wide Agents Summary (for "All" view) ──────────────────────
const ALL_KNOWN_AGENTS = [
  { code: "sales", name: "Blitz", role: "Sales & Pipeline" },
  { code: "accounting", name: "Penny", role: "Accounting & Invoices" },
  { code: "legal", name: "Tally", role: "Legal & Compliance" },
  { code: "support", name: "Haven", role: "Customer Support" },
  { code: "social", name: "Pixel", role: "Social Media" },
  { code: "estimating", name: "Gauge", role: "Estimating & Quotes" },
  { code: "shopfloor", name: "Forge", role: "Shop Floor & Production" },
  { code: "bizdev", name: "Atlas", role: "Business Development" },
  { code: "delivery", name: "Relay", role: "Delivery & Logistics" },
  { code: "data", name: "Rex", role: "Data & Analytics" },
  { code: "growth", name: "Prism", role: "Growth & Coaching" },
  { code: "talent", name: "Ally", role: "Talent & HR" },
  { code: "seo", name: "SEO", role: "Search Engine Optimization" },
  { code: "copywriting", name: "Copywriting", role: "Content & Copy" },
  { code: "webbuilder", name: "Web Builder", role: "Website Management" },
  { code: "email", name: "Email", role: "Email Management" },
  { code: "empire", name: "Empire", role: "Ventures & Architecture" },
  { code: "rebuild", name: "Rebuild", role: "System Architecture" },
  { code: "eisenhower", name: "Eisenhower Matrix", role: "Priority Matrix" },
  { code: "assistant", name: "Vizzy", role: "Operations Commander" },
];

function AgentReportDialog({ agent, data, domainStats }: {
  agent: { name: string; code: string; role: string };
  data?: SystemAgentSummary;
  domainStats?: AgentDomainStat[];
}) {
  const [open, setOpen] = useState(false);
  const hasActivity = !!data && data.totalSessions > 0;
  const hasStats = domainStats && domainStats.some(s => s.value > 0);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
        title={`${agent.name} Report`}
      >
        <ClipboardList className="w-4 h-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              {agent.name}
              <span className="text-sm font-normal text-muted-foreground">— {agent.role}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              {/* Domain Metrics */}
              {domainStats && domainStats.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> Domain Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {domainStats.map((s) => (
                      <div key={s.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                        <span className="text-sm font-semibold text-foreground">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today's Activity */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" /> Today's Activity
                </h4>
                {hasActivity ? (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    <span>Sessions: <strong className="text-foreground">{data!.totalSessions}</strong></span>
                    <span>Messages: <strong className="text-foreground">{data!.totalMessages}</strong></span>
                    <span>Users: <strong className="text-foreground">{data!.userCount}</strong></span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-3 py-2 bg-muted/40 rounded-lg">No activity recorded today</p>
                )}
              </div>

              {/* User Breakdown */}
              {hasActivity && data!.users.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> User Breakdown
                  </h4>
                  <div className="space-y-1">
                    {data!.users.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/40">
                        <span className="font-medium text-foreground">{u.fullName}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{u.sessions} sessions</span>
                          <span>{u.messages} msgs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasActivity && !hasStats && (
                <p className="text-sm text-muted-foreground text-center py-4 italic">No data available for this agent today</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SystemAgentsSummary() {
  const { data: agents, isLoading } = useSystemAgentSessions();
  const { data: domainStats } = useAgentDomainStats();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading agent activity…</span>
      </div>
    );
  }

  const activityMap = new Map<string, NonNullable<typeof agents>[number]>();
  for (const a of agents || []) {
    activityMap.set(a.agentName, a);
  }

  const knownNames = new Set(ALL_KNOWN_AGENTS.map((a) => a.name));
  const extraAgents = (agents || []).filter((a) => !knownNames.has(a.agentName));
  const activeCount = (agents || []).length;

  const allRows = [
    ...ALL_KNOWN_AGENTS.map((a) => ({ displayName: a.name, code: a.code, role: a.role, data: activityMap.get(a.name) })),
    ...extraAgents.map((a) => ({ displayName: a.agentName, code: "", role: "", data: a })),
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
        <Bot className="w-4 h-4 text-primary" />
        <h3 className="text-base font-semibold text-foreground flex-1">Agent Activity — All Users</h3>
        <span className="text-xs text-muted-foreground">{activeCount} active today</span>
      </div>
      <Accordion type="multiple" className="divide-y divide-border">
        {allRows.map(({ displayName, code, role, data }) => {
          const hasActivity = !!data && data.totalSessions > 0;
          const agentStats = code && domainStats ? domainStats[code] : undefined;
          const hasStats = agentStats && agentStats.some(s => s.value > 0);
          return (
            <AccordionItem key={displayName} value={displayName} className="border-none">
              <div className="flex items-center">
                <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-3 w-full">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center ${hasActivity || hasStats ? "bg-primary/20" : "bg-muted"}`}>
                        <Bot className={`w-4 h-4 ${hasActivity || hasStats ? "text-primary" : "text-muted-foreground/50"}`} />
                      </span>
                      <div className="flex flex-col items-start">
                        <span className={`font-semibold text-sm ${hasActivity || hasStats ? "text-foreground" : "text-muted-foreground"}`}>{displayName}</span>
                        {role && <span className="text-[10px] text-muted-foreground leading-tight">{role}</span>}
                      </div>
                      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground mr-2">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {data?.userCount ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {data?.totalSessions ?? 0} sessions
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {data?.totalMessages ?? 0} msgs
                        </span>
                      </div>
                    </div>
                    {agentStats && (
                      <div className="ml-11 flex items-center gap-2 text-xs text-muted-foreground">
                        <BarChart3 className="w-3 h-3 text-primary/60" />
                        {hasStats
                          ? agentStats.filter(s => s.value > 0).map((s, i) => (
                              <span key={s.label}>
                                {i > 0 && <span className="mx-1">·</span>}
                                {s.value} {s.label.toLowerCase()}
                              </span>
                            ))
                          : <span>No active items</span>
                        }
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AgentReportDialog
                  agent={{ name: displayName, code, role: role || displayName }}
                  data={data}
                  domainStats={agentStats}
                />
              </div>
              <AccordionContent className="px-4 pb-3">
                <div className="space-y-1.5 ml-11">
                  {hasActivity && data!.users.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/40"
                    >
                      <span className="font-medium text-foreground">{u.fullName}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{u.sessions} sessions</span>
                        <span>{u.messages} msgs</span>
                      </div>
                    </div>
                  ))}
                  {agentStats && hasStats && (
                    <div className="flex flex-wrap gap-2 py-1.5 px-3">
                      {agentStats.map((s) => (
                        <span key={s.label} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {s.value} {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {!hasActivity && !hasStats && (
                    <div className="text-sm text-muted-foreground py-1.5 px-3">
                      No activity today
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

const SUPER_EDIT_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop"];

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
  const [editingAgents, setEditingAgents] = useState(false);
  const [editingAutomations, setEditingAutomations] = useState(false);
  const [editingItems, setEditingItems] = useState(false);

  // Filter @rebar.shop profiles, active first
  const rebarProfiles = useMemo(() => {
    return profiles
      .filter((p) => p.email?.endsWith("@rebar.shop"))
      .sort((a, b) => {
        if (a.is_active === b.is_active) return a.full_name.localeCompare(b.full_name);
        return a.is_active ? -1 : 1;
      });
  }, [profiles]);

  // Fetch user roles for display in the user tab bar
  const { data: userRolesData } = useQuery({
    queryKey: ["vizzy_brain_user_roles"],
    queryFn: async () => {
      const userIds = rebarProfiles.filter(p => p.user_id).map(p => p.user_id);
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds as string[]);
      return data || [];
    },
    enabled: rebarProfiles.length > 0,
  });

  const roleMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (userRolesData) {
      for (const r of userRolesData) {
        const uid = (r as any).user_id;
        if (!map[uid]) map[uid] = [];
        map[uid].push((r as any).role);
      }
    }
    return map;
  }, [userRolesData]);

  const selectedProfile = rebarProfiles.find((p) => p.id === selectedProfileId);

  // Team daily activity for "All" Items view
  const allProfileSlims = useMemo(() => rebarProfiles.filter(p => p.email !== "ai@rebar.shop").map(p => ({ id: p.id, user_id: p.user_id })), [rebarProfiles]);
  const { data: teamDailyData } = useTeamDailyActivity(allProfileSlims, new Date());

  // Super admin edit capability
  const viewerEmail = user?.email?.toLowerCase() ?? "";
  const canEditAccess = SUPER_EDIT_EMAILS.includes(viewerEmail);
  const { override: accessOverride, saveAgents, saveAutomations, saveMenus } = useUserAccessOverrides(selectedProfile?.email);

  // All available agents for the editor
  const allAgentItems = useMemo(() => Object.entries(agentConfigs).map(([key, cfg]) => ({ id: key, label: `${cfg.name} — ${cfg.role}` })), []);
  const allAutomationItems = useMemo(() => defaultAutomations.map((a) => ({ id: a.id, label: a.name })), []);
  const allMenuItems = useMemo(() => ALL_MENUS.map((m) => ({ id: m, label: m })), []);

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
    const userMenus = accessOverride?.menus?.length ? accessOverride.menus : getVisibleMenus(targetEmail);
    const accessibleGroups = grouped.filter((group) => {
      const requiredMenu = GROUP_TO_MENU[group.key];
      if (!requiredMenu) return true;
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

    // Compute team-wide stats for "All" Items view
    const teamStats = !selectedProfile && teamDailyData ? (() => {
      let totalActivities = 0, totalHours = 0, totalAI = 0, totalEmails = 0;
      const profileNames = new Map<string, string>();
      for (const p of rebarProfiles) profileNames.set(p.id, p.full_name?.split(" ")[0] || "User");
      for (const pid of Object.keys(teamDailyData)) {
        const d = teamDailyData[pid];
        totalActivities += d.activities.length;
        totalHours += d.hoursToday;
        totalAI += d.aiSessionsToday;
        totalEmails += d.emailsSent;
      }
      return { totalActivities, totalHours: Math.round(totalHours * 10) / 10, totalAI, totalEmails, profileNames };
    })() : null;

    return (
      <div className="rounded-xl border border-border bg-card relative">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
          <FileBarChart className="w-4 h-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground flex-1">Items</h3>
          {canEditAccess && selectedProfile?.email && (
            <button
              onClick={() => { setEditingItems(!editingItems); setEditingAgents(false); setEditingAutomations(false); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Edit menu access"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <GeneralReportPDFButton date={userSelectedDate} userId={selectedProfile?.user_id} userName={selectedProfile?.full_name} />
        </div>
        {editingItems && canEditAccess && selectedProfile?.email && (
          <AccessEditorPopover
            title={`Menu Access — ${selectedProfile.full_name?.split(" ")[0]}`}
            allItems={allMenuItems}
            selectedIds={accessOverride?.menus?.length ? accessOverride.menus : getVisibleMenus(selectedProfile.email)}
            onSave={(ids) => saveMenus.mutate({ email: selectedProfile.email!, menus: ids, updatedBy: viewerEmail })}
            onClose={() => setEditingItems(false)}
          />
        )}
        <div className="p-3">
          {/* Summary stats banner for "All" view */}
          {teamStats && (
            <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">System Summary — Today</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-2 border border-border">
                  <Activity className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{teamStats.totalActivities}</div>
                    <div className="text-[10px] text-muted-foreground">Activities</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-2 border border-border">
                  <Clock className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{teamStats.totalHours}h</div>
                    <div className="text-[10px] text-muted-foreground">Hours Worked</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-2 border border-border">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{teamStats.totalAI}</div>
                    <div className="text-[10px] text-muted-foreground">AI Sessions</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-card rounded-lg px-3 py-2 border border-border">
                  <Mail className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{teamStats.totalEmails}</div>
                    <div className="text-[10px] text-muted-foreground">Emails Sent</div>
                  </div>
                </div>
              </div>
              {/* Per-user performance row */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rebarProfiles.filter(p => p.email !== "ai@rebar.shop").map(p => {
                  const d = teamDailyData?.[p.id];
                  if (!d || (d.activities.length === 0 && d.hoursToday === 0)) return null;
                  const firstName = p.full_name?.split(" ")[0] || "?";
                  return (
                    <span key={p.id} className="inline-flex items-center gap-1 text-[10px] bg-card border border-border rounded-full px-2 py-0.5">
                      <span className={`w-4 h-4 rounded-full ${getUserAvatarColor(p.full_name || "")} text-white flex items-center justify-center text-[8px] font-bold`}>
                        {firstName.charAt(0)}
                      </span>
                      <span className="font-medium text-foreground">{firstName}</span>
                      <span className="text-muted-foreground">{d.activities.length}act</span>
                      {d.hoursToday > 0 && <span className="text-muted-foreground">{d.hoursToday.toFixed(1)}h</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* Accessible menu items for this user */}
          {selectedProfile?.email && (() => {
            const userMenuItems = accessOverride?.menus?.length ? accessOverride.menus : getVisibleMenus(selectedProfile.email);
            return userMenuItems.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {userMenuItems.map(menu => (
                  <span key={menu} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    {menu}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
          <Accordion type="multiple" className="w-full space-y-1">
            {sectionsToShow.map((group) => {
              // For "All" view, compute per-user contributions for this category
              const categoryUserStats = !selectedProfile && teamDailyData && teamStats ? (() => {
                // Match category group to activity types is not straightforward,
                // so show memory entry count per category only
                return null;
              })() : null;

              return (
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
              );
            })}
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
        className="relative w-full max-w-7xl max-h-[92vh] mx-4 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
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
            {!selectedProfileId && (
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !hasCompanyContext} className="gap-1">
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {analyzing ? "Analyzing..." : "Analyze Now"}
              </Button>
            )}
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
          <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedProfileId(null)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
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
              const avatarColor = getUserAvatarColor(p.full_name || "");
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProfileId(isSelected ? null : p.id); setUserSelectedDate(new Date()); }}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                      : "bg-muted hover:bg-muted/80"
                  } ${!p.is_active ? "opacity-50" : ""}`}
                  title={`${p.full_name} (${p.email})`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor}`}>
                    {initial}
                  </span>
                  <span className="text-sm font-bold">{firstName}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {!selectedProfile && rebarProfiles.length > 0 && (
            <>
              <TeamDailyReport
                profiles={rebarProfiles.filter((p) => p.email !== "ai@rebar.shop")}
                timezone={timezone}
              />
              <SystemAgentsSummary />
            </>
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
                  <SectionDetailReportDialog
                    sectionType="overview"
                    profileId={selectedProfile.id}
                    userId={selectedProfile.user_id}
                    userName={selectedProfile.full_name || "User"}
                    date={userSelectedDate}
                    timezone={timezone}
                  />
                </div>
                {/* User role & job title */}
                <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2 text-sm">
                  <span className="font-semibold">{selectedProfile.full_name}</span>
                  {selectedProfile.user_id && roleMap[selectedProfile.user_id]?.length > 0 && (
                    <span className="text-[11px] uppercase font-bold text-primary">
                      {roleMap[selectedProfile.user_id].join(", ")}
                    </span>
                  )}
                  {selectedProfile.title && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground text-xs">{selectedProfile.title}</span>
                    </>
                  )}
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
                <div className="rounded-xl border border-border bg-card relative">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                    <BotIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground flex-1">Agents</h3>
                    {canEditAccess && (
                      <button
                        onClick={() => { setEditingAgents(!editingAgents); setEditingAutomations(false); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit agent access"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <UserFullReportButton
                      profile={selectedProfile}
                      timezone={timezone}
                      date={userSelectedDate}
                    />
                  </div>
                  {editingAgents && canEditAccess && selectedProfile.email && (
                    <AccessEditorPopover
                      title={`Agent Access — ${selectedProfile.full_name?.split(" ")[0]}`}
                      allItems={allAgentItems}
                      selectedIds={accessOverride?.agents?.length ? accessOverride.agents : getVisibleAgents(selectedProfile.email)}
                      onSave={(ids) => saveAgents.mutate({ email: selectedProfile.email!, agents: ids, updatedBy: viewerEmail })}
                      onClose={() => setEditingAgents(false)}
                    />
                  )}
                  <div className="p-3">
                    <UserAgentsSections
                      userId={selectedProfile.user_id}
                      name={selectedProfile.full_name?.split(" ")[0] || "User"}
                      email={selectedProfile.email}
                      overrideAgents={accessOverride?.agents}
                      onEditAgents={() => setEditingAgents(true)}
                      canEdit={canEditAccess}
                      date={userSelectedDate}
                    />
                  </div>
                </div>
              )}

              {/* Section 2.5: Automations */}
              {selectedProfile.email && selectedProfile.email !== "ai@rebar.shop" && (
                <div className="relative">
                  <UserAutomationsSection
                    email={selectedProfile.email}
                    overrideAutomations={accessOverride?.automations}
                    onEditAutomations={() => { setEditingAutomations(!editingAutomations); setEditingAgents(false); }}
                    canEdit={canEditAccess}
                  />
                  {editingAutomations && canEditAccess && (
                    <AccessEditorPopover
                      title={`Automations — ${selectedProfile.full_name?.split(" ")[0]}`}
                      allItems={allAutomationItems}
                      selectedIds={accessOverride?.automations?.length ? accessOverride.automations : defaultAutomations.filter(a => !ADMIN_ONLY_IDS.has(a.id)).map(a => a.id)}
                      onSave={(ids) => saveAutomations.mutate({ email: selectedProfile.email!, automations: ids, updatedBy: viewerEmail })}
                      onClose={() => setEditingAutomations(false)}
                    />
                  )}
                </div>
              )}

              {/* Section 3: System Performance Overview */}
              <div className="rounded-xl border border-border bg-card relative">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground flex-1">System Performance Overview</h3>
                  <SectionDetailReportDialog
                    sectionType="activity"
                    profileId={selectedProfile.id}
                    userId={selectedProfile.user_id}
                    userName={selectedProfile.full_name || "User"}
                    date={userSelectedDate}
                    timezone={timezone}
                  />
                </div>
                <div className="p-3">
                  <UserActivitySection profileId={selectedProfile.id} userId={selectedProfile.user_id} timezone={timezone} date={userSelectedDate} />
                </div>
              </div>

              {/* Section 4: Time Clock Detail */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground flex-1">Time Clock</h3>
                  <SectionDetailReportDialog
                    sectionType="timeclock"
                    profileId={selectedProfile.id}
                    userId={selectedProfile.user_id}
                    userName={selectedProfile.full_name || "User"}
                    date={userSelectedDate}
                    timezone={timezone}
                  />
                </div>
                <div className="p-3">
                  <UserTimeClockSection profileId={selectedProfile.id} userId={selectedProfile.user_id} timezone={timezone} date={userSelectedDate} />
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
