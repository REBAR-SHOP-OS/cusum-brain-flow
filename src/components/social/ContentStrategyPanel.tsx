import { useState, useMemo } from "react";
import {
  Calendar, Target, BarChart3, Clock, CheckCircle2,
  ChevronRight, Smartphone, Globe, Flag, Sparkles,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  yearlyEvents,
  contentPillars,
  weeklySchedule,
  platformStrategies,
  monthlyKpiTargets,
  implementationChecklist,
  getEventsForMonth,
  type CalendarEvent,
} from "./contentStrategyData";
import type { SocialPost } from "@/hooks/useSocialPosts";

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const regionBadge: Record<string, { label: string; className: string }> = {
  CA: { label: "🇨🇦 Canada", className: "bg-red-500/10 text-red-600 border-red-200" },
  global: { label: "🌍 Global", className: "bg-blue-500/10 text-blue-600 border-blue-200" },
  industry: { label: "🏗️ Industry", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
};

interface ContentStrategyPanelProps {
  completedChecklist?: string[];
  onToggleChecklist?: (id: string) => void;
  posts?: SocialPost[];
}

function computeKpis(posts: SocialPost[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthPosts = posts.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const publishedThisMonth = thisMonthPosts.filter((p) => p.status === "published");

  const totalReach = thisMonthPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const totalImpressions = thisMonthPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalLikes = thisMonthPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = thisMonthPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const totalShares = thisMonthPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
  const totalSaves = thisMonthPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
  const totalClicks = thisMonthPosts.reduce((sum, p) => sum + (p.clicks || 0), 0);

  const totalEngagements = totalLikes + totalComments + totalShares + totalSaves;
  const engagementRate = totalReach > 0 ? ((totalEngagements / totalReach) * 100) : 0;

  return {
    postsPublished: publishedThisMonth.length,
    totalReach,
    totalImpressions,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    totalClicks,
    engagementRate,
    totalEngagements,
    totalPosts: thisMonthPosts.length,
  };
}

export function ContentStrategyPanel({
  completedChecklist = [],
  onToggleChecklist,
  posts = [],
}: ContentStrategyPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const monthEvents = useMemo(() => getEventsForMonth(selectedMonth + 1), [selectedMonth]);

  const checklistProgress = Math.round(
    (completedChecklist.length / implementationChecklist.length) * 100
  );

  const kpis = useMemo(() => computeKpis(posts), [posts]);

  // Build real KPI cards with actual vs target
  const realKpis = [
    {
      metric: "Posts Published",
      actual: kpis.postsPublished,
      target: 22,
      icon: "📝",
      description: `${kpis.totalPosts} total this month`,
      format: (v: number) => String(v),
    },
    {
      metric: "Total Reach",
      actual: kpis.totalReach,
      target: 20000,
      icon: "👁️",
      description: `${kpis.totalImpressions.toLocaleString()} impressions`,
      format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v),
    },
    {
      metric: "Engagement Rate",
      actual: kpis.engagementRate,
      target: 4.5,
      icon: "💬",
      description: `${kpis.totalEngagements.toLocaleString()} total engagements`,
      format: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      metric: "Website Clicks",
      actual: kpis.totalClicks,
      target: 400,
      icon: "🔗",
      description: "Clicks to rebar.shop from social",
      format: (v: number) => v.toLocaleString(),
    },
    {
      metric: "Likes",
      actual: kpis.totalLikes,
      target: 500,
      icon: "❤️",
      description: `${kpis.totalComments} comments, ${kpis.totalShares} shares`,
      format: (v: number) => v.toLocaleString(),
    },
    {
      metric: "Saves",
      actual: kpis.totalSaves,
      target: 100,
      icon: "🔖",
      description: "Content saved by audience",
      format: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Tabs defaultValue="calendar" className="w-full">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent h-12 gap-1">
            <TabsTrigger value="calendar" className="gap-1.5 data-[state=active]:bg-muted">
              <Calendar className="w-3.5 h-3.5" /> Events
            </TabsTrigger>
            <TabsTrigger value="pillars" className="gap-1.5 data-[state=active]:bg-muted">
              <Target className="w-3.5 h-3.5" /> Pillars
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5 data-[state=active]:bg-muted">
              <Clock className="w-3.5 h-3.5" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="platforms" className="gap-1.5 data-[state=active]:bg-muted">
              <Smartphone className="w-3.5 h-3.5" /> Platforms
            </TabsTrigger>
            <TabsTrigger value="kpis" className="gap-1.5 data-[state=active]:bg-muted">
              <BarChart3 className="w-3.5 h-3.5" /> KPIs
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5 data-[state=active]:bg-muted">
              <CheckCircle2 className="w-3.5 h-3.5" /> Launch
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Events Calendar ─── */}
        <TabsContent value="calendar" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Monthly Event Calendar</h3>
            <span className="text-xs text-muted-foreground ml-auto">{yearlyEvents.length} events/year</span>
          </div>

          {/* Month selector */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {months.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                  selectedMonth === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Events list */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {monthEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No events in {months[selectedMonth]}</p>
            ) : (
              monthEvents.map((event, i) => (
                <EventCard key={`${event.month}-${event.day}-${i}`} event={event} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ─── Content Pillars ─── */}
        <TabsContent value="pillars" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">5 Content Pillars</h3>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {contentPillars.map((pillar) => (
              <div key={pillar.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-lg", pillar.color)}>
                    {pillar.emoji}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{pillar.name}</p>
                    <p className="text-xs text-muted-foreground">{pillar.description}</p>
                  </div>
                </div>
                <div className="pl-10 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Example Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {pillar.exampleTopics.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs bg-muted/70 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">CTAs</p>
                  <p className="text-xs text-muted-foreground">{pillar.ctaExamples[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── Weekly Schedule ─── */}
        <TabsContent value="schedule" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Weekly Posting Schedule</h3>
            <Badge variant="outline" className="ml-auto text-xs">5 posts/week</Badge>
          </div>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {weeklySchedule.map((day) => {
              const pillar = contentPillars.find((p) => p.id === day.pillarId);
              return (
                <div key={day.day} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{day.dayShort}</span>
                      <span className="text-sm font-medium text-primary">{day.theme}</span>
                    </div>
                    {pillar && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{pillar.emoji} {pillar.name}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{day.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(day.bestTimes).map(([platform, time]) => (
                      <span key={platform} className="text-xs text-muted-foreground">
                        <span className="font-medium capitalize">{platform}</span>: {time}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Platform Breakdown ─── */}
        <TabsContent value="platforms" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Platform Breakdown</h3>
          </div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {platformStrategies.map((ps) => {
              // Compute real post count per platform
              const platformKey = ps.platform.toLowerCase();
              const platformPosts = posts.filter((p) => p.platform === platformKey);
              const publishedCount = platformPosts.filter((p) => p.status === "published").length;
              const scheduledCount = platformPosts.filter((p) => p.status === "scheduled").length;

              return (
                <div key={ps.platform} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ps.icon}</span>
                      <span className="font-medium text-sm">{ps.platform}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {publishedCount} published
                      </Badge>
                      <Badge variant="outline" className="text-xs">{ps.postsPerWeek}/week</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Content Mix</p>
                      {ps.contentMix.map((c) => (
                        <p key={c} className="text-muted-foreground">• {c}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Best Time</p>
                      <p className="text-muted-foreground">{ps.bestTimeGeneral}</p>
                      <p className="font-medium text-muted-foreground mt-2 mb-1">Tone</p>
                      <p className="text-muted-foreground">{ps.toneGuide}</p>
                    </div>
                  </div>
                  {scheduledCount > 0 && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      📅 {scheduledCount} post{scheduledCount > 1 ? "s" : ""} scheduled
                    </p>
                  )}
                  <p className="text-xs text-primary/80 bg-primary/5 rounded px-2 py-1">{ps.notes}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── KPIs (Real Data) ─── */}
        <TabsContent value="kpis" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Monthly KPIs — Live</h3>
            <Badge variant="outline" className="ml-auto text-xs">
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {realKpis.map((kpi) => {
              const pct = kpi.target > 0 ? Math.min((kpi.actual / kpi.target) * 100, 100) : 0;
              const isOnTrack = pct >= 50;
              return (
                <div key={kpi.metric} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-2xl">{kpi.icon}</p>
                    {isOnTrack ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : kpi.actual > 0 ? (
                      <TrendingDown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xl font-bold">{kpi.format(kpi.actual)}</p>
                  <p className="text-sm font-medium">{kpi.metric}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Target: {kpi.format(kpi.target)}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{kpi.description}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Implementation Checklist ─── */}
        <TabsContent value="checklist" className="p-4 mt-0">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Implementation Checklist</h3>
            <span className="text-xs text-muted-foreground ml-auto">{completedChecklist.length}/{implementationChecklist.length}</span>
          </div>
          <Progress value={checklistProgress} className="mb-4 h-2" />

          {(["setup", "content", "launch", "ongoing"] as const).map((cat) => {
            const items = implementationChecklist.filter((c) => c.category === cat);
            const catLabels = { setup: "🛠️ Setup", content: "📝 Content", launch: "🚀 Launch", ongoing: "🔄 Ongoing" };
            return (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{catLabels[cat]}</p>
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const done = completedChecklist.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onToggleChecklist?.(item.id)}
                        className={cn(
                          "w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors",
                          done ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <CheckCircle2 className={cn(
                          "w-4 h-4 mt-0.5 shrink-0",
                          done ? "text-primary" : "text-muted-foreground/40"
                        )} />
                        <div>
                          <p className={cn("text-sm font-medium", done && "line-through opacity-60")}>{item.step}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const badge = regionBadge[event.region];
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0">
        <span className="text-xs font-bold leading-none">{event.day}</span>
        <span className="text-[10px] text-muted-foreground">{months[event.month - 1]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium truncate">{event.name}</p>
          {badge && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", badge.className)}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{event.contentTheme}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {event.hashtags.slice(0, 3).map((h) => (
            <span key={h} className="text-[10px] text-primary/80">{h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
