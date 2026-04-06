import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Brain, Zap, Loader2, AlertTriangle, Clock, Activity, Mail, Bot, Users } from "lucide-react";
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
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { Bot as BotIcon } from "lucide-react";

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

/** Live clock component that updates every second */
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
function PerformanceCard({ profileId, userId, name, timezone }: { profileId: string; userId: string | null; name: string; timezone: string }) {
  const { data, isLoading } = useUserPerformance(profileId, userId);

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
  const assignedMapping = getUserAgentMapping(email);

  // Build merged list: assigned agent + any additional agents from sessions
  const mergedAgents = React.useMemo(() => {
    const result: Array<{
      agentName: string;
      agentRole: string;
      isAssigned: boolean;
      sessionCount: number;
      totalMessages: number;
      lastUsed: string;
      recentMessages: { role: string; content: string; created_at: string }[];
    }> = [];

    // Add assigned agent first
    if (assignedMapping) {
      const config = agentConfigs[assignedMapping.agentKey];
      const sessionData = sessionAgents?.find(
        (s) => s.agentName.toLowerCase() === (config?.name?.toLowerCase() ?? assignedMapping.agentKey)
      );
      result.push({
        agentName: config?.name ?? assignedMapping.agentKey,
        agentRole: config?.role ?? assignedMapping.userRole,
        isAssigned: true,
        sessionCount: sessionData?.sessionCount ?? 0,
        totalMessages: sessionData?.totalMessages ?? 0,
        lastUsed: sessionData?.lastUsed ?? "",
        recentMessages: sessionData?.recentMessages ?? [],
      });
    }

    // Add any other agents from sessions that aren't the assigned one
    for (const s of sessionAgents ?? []) {
      const alreadyAdded = result.some((r) => r.agentName.toLowerCase() === s.agentName.toLowerCase());
      if (!alreadyAdded) {
        result.push({
          agentName: s.agentName,
          agentRole: "",
          isAssigned: false,
          sessionCount: s.sessionCount,
          totalMessages: s.totalMessages,
          lastUsed: s.lastUsed,
          recentMessages: s.recentMessages,
        });
      }
    }

    return result;
  }, [assignedMapping, sessionAgents]);

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
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Assigned</span>
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

export function VizzyBrainPanel({ onClose }: Props) {
  const { entries, isLoading, error, isCompanyLoading, hasCompanyContext, analyzeSystem } = useVizzyMemory();
  const { timezone } = useWorkspaceSettings();
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

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

    const sectionsToShow = selectedProfile
      ? grouped.filter((group) => group.items.length > 0)
      : grouped;

    if (selectedProfile && sectionsToShow.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm font-medium">No activity found</p>
          <p className="text-xs mt-1">This user has no recorded entries in any section.</p>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="w-full space-y-1">
        {sectionsToShow.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border border-border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                {group.label}
                <span className="text-xs text-muted-foreground font-normal">({group.items.length})</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DateGroupedEntries items={group.items} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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
        className="relative w-full max-w-2xl max-h-[85vh] mx-4 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Vizzy Brain</h2>
            <span className="text-xs text-muted-foreground">({filteredEntries.length})</span>
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
                  onClick={() => setSelectedProfileId(isSelected ? null : p.id)}
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {selectedProfile && (
            <div className="space-y-4">
              {/* Section 1: General Overview */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                  <Activity className="w-4 h-4 text-primary" />
                   <h3 className="text-sm font-semibold text-foreground">General Overview</h3>
                </div>
                <div className="p-3">
                  <PerformanceCard
                    profileId={selectedProfile.id}
                    userId={selectedProfile.user_id}
                    name={selectedProfile.full_name?.split(" ")[0] || "User"}
                    timezone={timezone}
                  />
                </div>
              </div>

              {/* Section 2: Agents */}
              {selectedProfile.user_id && selectedProfile.email !== "ai@rebar.shop" && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                    <Bot className="w-4 h-4 text-primary" />
                     <h3 className="text-sm font-semibold text-foreground">Agents</h3>
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
            </div>
          )}
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  );
}
