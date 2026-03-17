import { useState, useMemo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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

const PERSIAN_EVENT_INFO: Record<string, { summary: string; details: string }> = {
  "New Year's Day": { summary: "آغاز سال نوی میلادی", details: "اول ژانویه، روز شروع دوباره و تعیین اهداف جدید است. در صنعت ساخت‌وساز، این زمان مناسبی برای برنامه‌ریزی پروژه‌ها، بستن قراردادهای تأمین مصالح و بررسی درس‌های سال گذشته است. بسیاری از پیمانکاران در این روز بودجه سال جدید را نهایی می‌کنند." },
  "Family Literacy Day (CA)": { summary: "روز سوادآموزی خانواده در کانادا", details: "این روز از سال ۱۹۹۹ در کانادا برگزار می‌شود و بر اهمیت یادگیری در خانواده تأکید دارد. برای صنعت ما، فرصتی عالی برای معرفی برنامه‌های کارآموزی، ارزش آموزش در حرفه‌های فنی و اهمیت راهنمایی نسل جدید کارگران ماهر است." },
  "Black History Month": { summary: "ماه تاریخ سیاه‌پوستان", details: "در فوریه هر سال، دستاوردها و مشارکت‌های جوامع سیاه‌پوست گرامی داشته می‌شود. در صنعت ساخت‌وساز، فرصتی است برای بزرگداشت تنوع، معرفی سازندگان، مهندسان و کارگران ماهر سیاه‌پوست که نقش مهمی در شکل‌دهی صنعت ما داشته‌اند." },
  "Valentine's Day": { summary: "روز ولنتاین", details: "روز عشق و قدردانی، فرصتی خلاقانه برای کسب‌وکارهای ساختمانی. با پیام‌هایی مثل «ما عاشق کاری هستیم که انجام می‌دهیم» می‌توان عشق به حرفه، قدردانی از مشتریان وفادار و اشتیاق تیم را به نمایش گذاشت." },
  "Family Day (Ontario)": { summary: "روز خانواده در انتاریو", details: "از سال ۲۰۰۸ تعطیل رسمی در انتاریو است. برای کسب‌وکارهای خانوادگی ساختمانی، فرصتی برای نشان دادن ارزش‌های خانوادگی، دانش نسل به نسل منتقل‌شده در حرفه، و فرهنگ تیمی که مثل خانواده کار می‌کند." },
  "International Women's Day": { summary: "روز جهانی زن", details: "از سال ۱۹۱۱ در ۸ مارس برگزار می‌شود. در صنعت ساخت‌وساز که زنان فقط حدود ۵٪ نیروی کار را تشکیل می‌دهند، این روز اهمیت ویژه‌ای دارد. فرصتی برای معرفی زنان در حرفه‌های فنی، مهندسی و مدیریت پروژه که موانع را شکسته‌اند." },
  "St. Patrick's Day": { summary: "روز سنت پاتریک", details: "جشن فرهنگی ایرلندی که اکنون در سراسر جهان با رنگ سبز برگزار می‌شود. شرکت‌های ساختمانی می‌توانند با پیام‌های شاد مثل «خوش‌شانسیم که بهترین تیم را داریم» روحیه تیمی و ساخت‌وساز سبز و پایدار را برجسته کنند." },
  "Nowruz (Persian New Year)": { summary: "نوروز — جشن باستانی آغاز بهار", details: "نوروز، کهن‌ترین جشن ایرانی، نماد نوسازی و شروعی تازه است. در صنعت عمرانی، همزمان با آغاز فصل ساخت‌وساز، فرصتی برای جشن گرفتن تنوع فرهنگی در تیم و شروع پروژه‌های جدید بهاری با انرژی تازه." },
  "First Day of Spring": { summary: "اولین روز بهار", details: "اعتدال بهاری نشان‌دهنده آغاز رسمی بهار و در کانادا، شروع فصل اوج ساخت‌وساز است. پس از رکود زمستانی، پروژه‌ها شتاب می‌گیرند، تیم‌ها بسیج می‌شوند و سفارش مصالح افزایش می‌یابد. بهترین زمان برای تبلیغ موجودی آماده و تحویل سریع." },
  "Good Friday (CA)": { summary: "جمعه نیک در کانادا", details: "تعطیل رسمی سراسری کانادا و مکثی قبل از فصل شلوغ بهاری ساخت‌وساز. زمانی مناسب برای تأمل در ایمنی محل کار، استراحت دادن به تیم و قدردانی از تلاش‌هایی که پروژه‌ها را پیش می‌برد." },
  "Earth Day": { summary: "روز زمین", details: "از سال ۱۹۷۰ در ۲۲ آوریل برگزار می‌شود و اکنون بیش از ۱ میلیارد نفر در ۱۹۳ کشور در آن مشارکت می‌کنند. میلگرد یکی از پربازیافت‌ترین مواد روی زمین است. فرصتی عالی برای نمایش تأمین فولاد بازیافتی، کاهش ضایعات و تعهد به ساخت‌وساز سبز." },
  "National Day of Mourning (CA)": { summary: "روز ملی عزاداری کانادا", details: "از سال ۱۹۸۴ در ۲۸ آوریل برگزار می‌شود و یادبود کارگرانی است که در محل کار جان باختند یا آسیب دیدند. ساخت‌وساز یکی از پرخطرترین صنایع است. این روز برای تبلیغات نیست — زمان یادبود، تعهد به ایمنی و هدف صفر حادثه است." },
  "May Day / Workers' Day": { summary: "روز جهانی کارگر", details: "از سال ۱۸۸۹ در اول مه برگزار می‌شود و جنبش کارگری را گرامی می‌دارد. برای صنعت ساخت‌وساز، روز بزرگداشت دست‌های ماهری است که شهرهایمان را می‌سازند — از آهنگران و سازندگان میلگرد تا اپراتورهای جرثقیل و بتن‌ریزان." },
  "North American Occupational Safety Week": { summary: "هفته ایمنی شغلی آمریکای شمالی", details: "هفته اول مه (NAOSH) ایمنی محل کار را در سراسر آمریکای شمالی ترویج می‌کند. برای کارگاه‌های تولید و کارگاه‌های ساختمانی، زمان ممیزی ایمنی، بازآموزی تجهیزات حفاظتی و اشتراک‌گذاری نکات ایمنی است." },
  "Mother's Day": { summary: "روز مادر", details: "دومین یکشنبه مه، روز بزرگداشت مادران است. برای شرکت‌های ساختمانی، فرصتی برای معرفی زنان رهبر در سازمان، جشن گرفتن مادران شاغل در حرفه‌های فنی و نشان دادن جنبه انسانی برند." },
  "Victoria Day (CA)": { summary: "روز ویکتوریا در کانادا", details: "تعطیل رسمی کانادا که شروع غیررسمی تابستان محسوب می‌شود. برای ساخت‌وساز، یک نقطه بررسی مهم است — زمانی مناسب برای نمایش پیشرفت پروژه‌ها و یادآوری به پیمانکاران برای سفارش قبل از تعطیلات آخر هفته طولانی." },
  "Pride Month": { summary: "ماه افتخار", details: "ژوئن ماه افتخار است و شورش استون‌وال ۱۹۶۹ و جوامع دگرباشان جنسی را گرامی می‌دارد. در صنعت ساخت‌وساز — که به‌طور سنتی محافظه‌کارانه است — حمایت از فراگیری پیام قدرتمندی ارسال می‌کند. سیاست‌های تنوع و فرهنگ پذیرش را برجسته کنید." },
  "Father's Day": { summary: "روز پدر", details: "سومین یکشنبه ژوئن، روز بزرگداشت پدران است. بسیاری از حرفه‌ها نسل به نسل منتقل می‌شوند. داستان‌های میراث خانوادگی در ساخت‌وساز، پدرانی که حرفه را به فرزندانشان آموختند و ارزش راهنمایی در ساختن کارگران قوی را به اشتراک بگذارید." },
  "National Indigenous Peoples Day (CA)": { summary: "روز ملی بومیان کانادا", details: "۲۱ ژوئن، میراث و فرهنگ ملل اول، اینوییت و متی در کانادا را به رسمیت می‌شناسد. این روز برای تبلیغات نیست — زمان احترام، یادگیری و حمایت از آشتی است. پروژه‌های ساختمانی به رهبری بومیان و مشارکت با جوامع بومی را برجسته کنید." },
  "Canada Day": { summary: "روز کانادا", details: "روز کانادا سالروز کنفدراسیون (اول ژوئیه ۱۸۶۷) را جشن می‌گیرد. برای شرکت‌های فولاد کانادایی، این لحظه نهایی «ساخت کانادا» است. مواد تأمین‌شده از کانادا، پروژه‌هایی که زیرساخت‌های کانادا را می‌سازند و افتخار به حمایت از اقتصاد داخلی را نمایش دهید." },
  "Civic Holiday (Ontario)": { summary: "تعطیلات شهری انتاریو", details: "اولین دوشنبه اوت تعطیل شهری در انتاریو است و اوج فصل ساخت‌وساز تابستانی را نشان می‌دهد. از این زمان برای نمایش پروژه‌های جاری، جشن دستاوردهای نیمه سال و استراحت دادن به تیم استفاده کنید." },
  "Labour Day (CA)": { summary: "روز کارگر در کانادا", details: "اولین دوشنبه سپتامبر، جنبش کارگری کانادا را گرامی می‌دارد و پایان غیررسمی تابستان و شروع فشار ساختمانی پاییزی است. کار سخت تیم را جشن بگیرید، کارگران ماهر را به رسمیت بشناسید و برای فصل شلوغ پاییز آماده شوید." },
  "National Day for Truth & Reconciliation": { summary: "روز ملی حقیقت و آشتی", details: "۳۰ سپتامبر (روز پیراهن نارنجی) از سال ۲۰۲۱ تعطیل رسمی فدرال شده و بازماندگان مدارس شبانه‌روزی و کودکانی که هرگز بازنگشتند را گرامی می‌دارد. این روز برای تأمل است — نه تبلیغات. لباس نارنجی بپوشید و منابع آموزشی را به اشتراک بگذارید." },
  "Construction Safety Month": { summary: "ماه ایمنی ساخت‌وساز", details: "اکتبر به‌عنوان ماه ایمنی ساخت‌وساز در سراسر آمریکای شمالی شناخته می‌شود. این کمپین یک‌ماهه بر محافظت در برابر سقوط، ایمنی تجهیزات، رعایت تجهیزات حفاظتی و هدف صفر حادثه تمرکز دارد. نکات ایمنی روزانه و دستاوردهای ایمنی تیم را به اشتراک بگذارید." },
  "World Mental Health Day": { summary: "روز جهانی سلامت روان", details: "۱۰ اکتبر به رهبری سازمان بهداشت جهانی آگاهی درباره سلامت روان را افزایش می‌دهد. کارگران ساختمانی با نرخ بالای افسردگی و اضطراب مواجه‌اند. این روز تبلیغاتی نیست — منابع سلامت روان را به اشتراک بگذارید و نشان دهید که درخواست کمک عادی است." },
  "Thanksgiving (CA)": { summary: "روز شکرگزاری کانادا", details: "دومین دوشنبه اکتبر، زمان سپاسگزاری است. از تیم، مشتریان، تأمین‌کنندگان و شرکا صمیمانه تشکر کنید. پروژه‌های تکمیل‌شده را برجسته کنید و بر دستاوردهای سال تأمل کنید. محتوای قدردانی واقعی عملکرد فوق‌العاده‌ای در شبکه‌های اجتماعی دارد." },
  "Halloween": { summary: "هالووین", details: "۳۱ اکتبر فرصتی خلاقانه و سرگرم‌کننده برای برندهای ساختمانی است. عکس‌های لباس تیم، داستان‌های «ترسناک» کارگاه یا تبلیغات موضوعی مثل «تحویل به‌طرز ترسناکی سریع!» را به اشتراک بگذارید. محتوای شاد و سبک برند شما را انسانی‌تر می‌کند." },
  "Remembrance Day (CA)": { summary: "روز یادبود کانادا", details: "۱۱ نوامبر جانبازان نظامی کانادا را گرامی می‌دارد. بسیاری از جانبازان پس از خدمت به صنعت ساخت‌وساز روی می‌آورند. این روز تبلیغاتی نیست — یک ادای احترام محترمانه منتشر کنید و قدرت و فداکاری خدمتگزاران را گرامی بدارید." },
  "Black Friday": { summary: "جمعه سیاه", details: "بزرگترین رویداد خرید سال. برای تأمین‌کنندگان ساختمانی B2B، پیام‌های فوریت‌محور مؤثرند: قیمت‌گذاری عمده محدود، تبلیغات موجودی آماده و تخفیف‌های پایان سال. پیمانکارانی که برای پروژه‌های بهاری برنامه‌ریزی می‌کنند، اغلب مصالح را با تخفیف آخر سال رزرو می‌کنند." },
  "Small Business Saturday": { summary: "شنبه کسب‌وکارهای کوچک", details: "از سال ۲۰۱۰ خرید از کسب‌وکارهای محلی را تشویق می‌کند. برای تأمین‌کنندگان مستقل فولاد، ریشه‌های محلی، مشارکت اجتماعی، خدمات شخصی‌سازی‌شده و اینکه حمایت از کسب‌وکارهای محلی اقتصاد را تقویت می‌کند را برجسته کنید." },
  "Cyber Monday": { summary: "دوشنبه سایبری", details: "دوشنبه سایبری بر تخفیف‌های آنلاین تمرکز دارد. برای تأمین‌کنندگان ساختمانی دارای فروشگاه آنلاین (مثل rebar.shop)، سیستم سفارش آنلاین، ابزارهای استعلام دیجیتال و راحتی سفارش مصالح از دفتر یا کارگاه را تبلیغ کنید." },
  "Christmas Day": { summary: "روز کریسمس", details: "۲۵ دسامبر زمان تبریک‌های صمیمانه فصل، مرور سال با برجسته‌ کردن پروژه‌های بزرگ و نقاط عطف، و جشن گرفتن با تیم است. پیام تعطیلات از مدیریت منتشر کنید و از مشتریان و شرکا قدردانی کنید." },
  "New Year's Eve": { summary: "شب سال نو", details: "آخرین روز سال برای محتوای بازنگری و آینده‌نگر عالی است. برترین دستاوردها، بزرگ‌ترین پروژه‌های تکمیل‌شده، نقاط عطف رشد و اهداف سال آینده را به اشتراک بگذارید. پست‌های «مرور سال» با آمار و عکس تعامل بالایی ایجاد می‌کنند." },
};

function EventCard({ event }: { event: CalendarEvent }) {
  const badge = regionBadge[event.region];
  const persianInfo = PERSIAN_EVENT_INFO[event.name];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
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
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-96 text-sm leading-relaxed max-h-[400px] overflow-y-auto" dir="ltr">
        <div className="space-y-3">
          {/* English section */}
          <div>
            <p className="font-semibold text-foreground mb-1">{event.name}</p>
            <p className="text-xs text-muted-foreground">{event.description}</p>
          </div>

          {/* Hashtags */}
          <div className="flex flex-wrap gap-1">
            {event.hashtags.map((h) => (
              <span key={h} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{h}</span>
            ))}
          </div>

          {/* Persian section */}
          {persianInfo && (
            <>
              <div className="border-t border-border" />
              <div dir="rtl" className="space-y-1">
                <p className="font-semibold text-foreground text-right">{persianInfo.summary}</p>
                <p className="text-xs text-muted-foreground text-right leading-relaxed">{persianInfo.details}</p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
