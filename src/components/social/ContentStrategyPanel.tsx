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

export const PERSIAN_EVENT_INFO: Record<string, { summary: string; details: string }> = {
  "New Year's Day": { summary: "آغاز سال نوی میلادی", details: "اول ژانویه، آغاز سال نوی میلادی بر اساس تقویم گریگوری است. سنت جشن گرفتن سال نو در این تاریخ از سال ۱۵۸۲ با پذیرش تقویم گریگوری آغاز شد. در فرهنگ‌های مختلف، این روز نماد تجدید، تأمل بر گذشته و امید به آینده است. جشن‌ها معمولاً شامل آتش‌بازی، دورهمی‌های خانوادگی و تعیین اهداف جدید برای سال پیش‌رو می‌شود." },
  "Family Literacy Day (CA)": { summary: "روز سوادآموزی خانواده در کانادا", details: "این روز از سال ۱۹۹۹ توسط سازمان ABC Life Literacy Canada بنیان‌گذاری شده و هر ساله در ۲۷ ژانویه برگزار می‌شود. هدف آن ترویج مطالعه و یادگیری به‌عنوان فعالیتی مشترک در خانواده است. تحقیقات نشان می‌دهد کودکانی که با خانواده‌هایشان مطالعه می‌کنند، مهارت‌های سوادآموزی قوی‌تری پیدا می‌کنند. این روز، کانادایی‌ها را در هر سنی به مشارکت در فعالیت‌های آموزشی خانوادگی تشویق می‌کند." },
  "Black History Month": { summary: "ماه تاریخ سیاه‌پوستان", details: "در فوریه هر سال در کانادا و آمریکا برگزار می‌شود. ریشه آن به «هفته تاریخ سیاه‌پوستان» برمی‌گردد که توسط مورخ کارتر جی. وودسون در سال ۱۹۲۶ ایجاد شد. کانادا رسماً در دسامبر ۱۹۹۵ پس از پیشنهاد ژان آگوستین، ماه تاریخ سیاه‌پوستان را به رسمیت شناخت. این ماه، مشارکت‌ها، دستاوردها و میراث جوامع سیاه‌پوست را گرامی می‌دارد و یادآور مبارزه مداوم برای برابری و عدالت است." },
  "Valentine's Day": { summary: "روز ولنتاین", details: "روز ولنتاین در ۱۴ فوریه برگزار می‌شود و به نام سنت ولنتاین، شهید مسیحی قرن سوم رُم نام‌گذاری شده است. این جشن در قرون وسطی، به‌ویژه از طریق نوشته‌های جفری چاسر، با عشق رمانتیک گره خورد. امروزه در سراسر جهان به‌عنوان روز ابراز عشق و قدردانی با کارت‌های تبریک، گل و هدیه برگزار می‌شود. اولین کارت‌های تجاری ولنتاین در اوایل دهه ۱۸۰۰ ظاهر شدند." },
  "Family Day (Ontario)": { summary: "روز خانواده در انتاریو", details: "روز خانواده در ۱۸ فوریه ۲۰۰۸ به‌عنوان تعطیل رسمی در انتاریو توسط نخست‌وزیر دالتون مک‌گینتی برقرار شد. هدف آن فراهم کردن یک روز اضافی برای خانواده‌ها در فاصله طولانی بین سال نو و جمعه نیک بود. آلبرتا و ساسکاچوان از سال‌های ۱۹۹۰ و ۲۰۰۷ تعطیل مشابهی داشتند. این تعطیل هر ساله در سومین دوشنبه فوریه برگزار می‌شود." },
  "International Women's Day": { summary: "روز جهانی زن", details: "روز جهانی زن از سال ۱۹۱۱ در ۸ مارس برگزار می‌شود، زمانی که بیش از یک میلیون نفر در اتریش، دانمارک، آلمان و سوئیس تظاهرات کردند. این روز از جنبش‌های کارگری و حق رأی زنان در اوایل قرن بیستم برخاست. سازمان ملل از سال ۱۹۷۵ این روز را جشن می‌گیرد. هر ساله یک موضوع جهانی با تمرکز بر برابری جنسیتی، حقوق زنان و شناسایی دستاوردهای زنان تعیین می‌شود." },
  "St. Patrick's Day": { summary: "روز سنت پاتریک", details: "روز سنت پاتریک در ۱۷ مارس برگزار می‌شود — تاریخ سنتی درگذشت سنت پاتریک (حدود ۳۸۵ تا ۴۶۱ میلادی)، قدیس حامی ایرلند. او در بریتانیای رومی متولد شد و در ۱۶ سالگی ربوده و به ایرلند به‌عنوان برده برده شد. پس از فرار و بازگشت سال‌ها بعد به‌عنوان مبلغ مسیحی، به او نسبت داده می‌شود که مسیحیت را به ایرلند آورد. شبدر سه‌برگ که ظاهراً برای توضیح تثلیث استفاده می‌کرد، نماد این جشن شد. امروزه این روز در سراسر جهان با رژه، لباس سبز و جشن‌های فرهنگی ایرلندی برگزار می‌شود." },
  "Nowruz (Persian New Year)": { summary: "نوروز — جشن باستانی آغاز بهار", details: "نوروز ('روز نو') جشن سال نوی ایرانی است که در اعتدال بهاری (حدود ۲۰ مارس) برگزار می‌شود. با ریشه‌هایی بیش از ۳۰۰۰ ساله در ایران باستان و سنن زرتشتی، نماد پیروزی نور بر تاریکی و تجدید طبیعت است. از سال ۲۰۰۹ در فهرست میراث فرهنگی ناملموس بشریت یونسکو ثبت شده و توسط بیش از ۳۰۰ میلیون نفر در ایران، افغانستان، تاجیکستان، کردستان، آذربایجان، آسیای مرکزی و جوامع مهاجر جهان جشن گرفته می‌شود. سفره هفت‌سین — هفت نماد که با حرف 'س' آغاز می‌شوند — چهارشنبه‌سوری (آتش‌بازی آخرین چهارشنبه قبل از نوروز) و سیزده‌بدر (روز طبیعت در روز سیزدهم) از مهم‌ترین سنن آن هستند." },
  "First Day of Spring": { summary: "اولین روز بهار", details: "اعتدال بهاری که حدود ۲۰ مارس رخ می‌دهد، آغاز نجومی بهار در نیمکره شمالی را نشان می‌دهد. در این روز، خورشید از استوای سماوی عبور می‌کند و ساعات تقریباً برابر روز و شب ایجاد می‌شود. واژه 'equinox' از لاتین 'aequinoctium' به‌معنای 'شب برابر' گرفته شده است. در فرهنگ‌های مختلف، اعتدال بهاری هزاران سال است که به‌عنوان زمان تجدید، تولد دوباره و بازگشت گرما پس از زمستان جشن گرفته می‌شود." },
  "Good Friday (CA)": { summary: "جمعه نیک در کانادا", details: "جمعه نیک یک جشن مسیحی به یاد مصلوب شدن عیسی مسیح است که در جمعه قبل از یکشنبه عید پاک برگزار می‌شود. این روز در تمام استان‌ها و قلمروهای کانادا تعطیل رسمی است. تاریخ آن هر سال تغییر می‌کند زیرا از تقویم شمسی-قمری پیروی می‌کند و معمولاً بین ۲۰ مارس تا ۲۳ آوریل قرار می‌گیرد. تصور می‌شود کلمه 'Good' در نام انگلیسی آن از معنای قدیمی‌تر 'مقدس' یا 'پرهیزکار' آمده باشد." },
  "Earth Day": { summary: "روز زمین", details: "روز زمین اولین بار در ۲۲ آوریل ۱۹۷۰ برگزار شد، زمانی که ۲۰ میلیون آمریکایی در اعتراض به تخریب محیط‌زیست به خیابان‌ها آمدند. این روز توسط سناتور آمریکایی گیلورد نلسون بنیان‌گذاری شد و به ایجاد آژانس حفاظت محیط‌زیست (EPA) و تصویب قوانین هوای پاک، آب پاک و گونه‌های در خطر انقراض منجر شد. امروزه بیش از ۱ میلیارد نفر در ۱۹۳ کشور روز زمین را برگزار می‌کنند که بزرگ‌ترین رویداد غیرمذهبی جهان است." },
  "National Day of Mourning (CA)": { summary: "روز ملی عزاداری کانادا", details: "این روز در سال ۱۹۸۴ توسط کنگره کارگری کانادا برقرار شد و در ۲۸ آوریل یادبود کارگرانی است که در محل کار جان باخته، آسیب دیده یا بیمار شده‌اند. کانادا اولین کشوری بود که رسماً روز عزاداری برای کارگران را به رسمیت شناخت. این تاریخ انتخاب شد زیرا در ۲۸ آوریل ۱۹۱۴، اولین قانون جامع غرامت کارگران در کانادا در انتاریو تأیید سلطنتی دریافت کرد. اکنون بیش از ۸۰ کشور این روز را برگزار می‌کنند. این روز برای یادبود محترمانه است — نه تبلیغات." },
  "May Day / Workers' Day": { summary: "روز جهانی کارگر", details: "روز جهانی کارگر در اول مه برگزار می‌شود و ریشه آن به جنبش کارگری اواخر قرن نوزدهم و مبارزه برای روز کاری هشت‌ساعته برمی‌گردد. این تاریخ به یادبود واقعه هی‌مارکت ۱۸۸۶ در شیکاگو انتخاب شد، جایی که اعتراض کارگری به خشونت کشیده شد. در سال ۱۸۸۹، انترناسیونال دوم اول مه را به‌عنوان روز جهانی کارگر اعلام کرد. امروزه در بیش از ۸۰ کشور تعطیل رسمی است و مشارکت‌ها و حقوق کارگران را در سراسر جهان گرامی می‌دارد." },
  "North American Occupational Safety Week": { summary: "هفته ایمنی شغلی آمریکای شمالی", details: "هفته ایمنی و بهداشت شغلی آمریکای شمالی (NAOSH) هر ساله در اولین هفته کامل ماه مه برگزار می‌شود. این رویداد از سال ۱۹۹۷ آغاز شده و همکاری مشترک کانادا، ایالات متحده و مکزیک برای ترویج ایمنی و بهداشت محل کار است. این هفته کارفرمایان و کارکنان را تشویق می‌کند تا بر پیشگیری از آسیب و بیماری در محل کار از طریق آموزش، تمرین و کمپین‌های آگاهی‌بخشی تمرکز کنند." },
  "Mother's Day": { summary: "روز مادر", details: "روز مادر در دومین یکشنبه ماه مه در کانادا، آمریکا و بسیاری از کشورها برگزار می‌شود. جشن مدرن آن توسط آنا جارویس در سال ۱۹۰۸ پایه‌گذاری شد، که پس از درگذشت مادرش برای تعیین یک روز ملی به افتخار مادران تلاش کرد. رئیس‌جمهور وودرو ویلسون در سال ۱۹۱۴ آن را رسماً تعطیل ملی اعلام کرد. این روز به ابراز سپاس و عشق به مادران و شخصیت‌های مادری از طریق کارت تبریک، گل و دورهمی‌های خانوادگی اختصاص دارد." },
  "Victoria Day (CA)": { summary: "روز ویکتوریا در کانادا", details: "روز ویکتوریا تعطیل رسمی کانادایی است که در آخرین دوشنبه قبل از ۲۵ مه برگزار می‌شود. این روز اصلاً در سال ۱۸۴۵ به مناسبت تولد ملکه ویکتوریا (۲۴ مه ۱۸۱۹) برقرار شد. از سال ۱۹۵۷، همچنین به‌عنوان تولد رسمی پادشاه حاکم کانادا خدمت می‌کند. این روز اغلب آغاز غیررسمی تابستان در کانادا محسوب می‌شود و با آتش‌بازی، فعالیت‌های فضای باز و باز کردن ویلاهای تابستانی همراه است." },
  "Pride Month": { summary: "ماه افتخار", details: "ماه افتخار در طول ماه ژوئن برگزار می‌شود و جامعه دگرباشان جنسی را گرامی داشته و شورش‌های استون‌وال ۲۸ ژوئن ۱۹۶۹ در نیویورک را یادبود می‌کند. این شورش‌ها نقطه عطفی در مبارزه برای حقوق دگرباشان بود. اولین رژه‌های افتخار در ۲۸ ژوئن ۱۹۷۰ در نیویورک، لس‌آنجلس، سان‌فرانسیسکو و شیکاگو برگزار شد. امروزه ماه افتخار در سراسر جهان با رژه‌ها، رویدادهای آموزشی و جشن‌هایی برای ترویج برابری، کرامت و شناسایی مشارکت‌های جامعه دگرباشان برگزار می‌شود." },
  "Father's Day": { summary: "روز پدر", details: "روز پدر در سومین یکشنبه ماه ژوئن در کانادا و بسیاری از کشورها برگزار می‌شود. جشن مدرن آن اولین بار در سال ۱۹۱۰ توسط سونورا اسمارت داد، با الهام از روز مادر، برای بزرگداشت پدرش که شش فرزند را به‌تنهایی بزرگ کرده بود، پیشنهاد شد. رئیس‌جمهور ریچارد نیکسون در سال ۱۹۷۲ رسماً آن را تعطیل ملی اعلام کرد. این روز به بزرگداشت پدران و شخصیت‌های پدری برای عشق، راهنمایی و مشارکتشان در زندگی خانوادگی اختصاص دارد." },
  "National Indigenous Peoples Day (CA)": { summary: "روز ملی بومیان کانادا", details: "۲۱ ژوئن روز ملی بومیان در کانادا است و میراث، فرهنگ‌های متنوع و مشارکت‌های برجسته ملل اول، اینوییت و متی را به رسمیت شناخته و جشن می‌گیرد. این تاریخ انتخاب شد زیرا با انقلاب تابستانی مصادف است که در بسیاری از فرهنگ‌های بومی اهمیت زیادی دارد. این روز در سال ۱۹۹۶ توسط فرماندار کل رومئو لوبلان رسماً اعلام شد. این روز برای یادبود محترمانه، یادگیری و تأمل است — نه تبلیغات." },
  "Canada Day": { summary: "روز کانادا", details: "روز کانادا در اول ژوئیه برگزار می‌شود و سالروز کنفدراسیون کانادا را جشن می‌گیرد. در این تاریخ در سال ۱۸۶۷، قانون آمریکای شمالی بریتانیا (اکنون قانون اساسی ۱۸۶۷) سه مستعمره — استان کانادا، نوا اسکوشیا و نیوبرانزویک — را در یک دومینیون واحد در امپراتوری بریتانیا متحد کرد. این تعطیل که در ابتدا 'روز دومینیون' نامیده می‌شد، در سال ۱۹۸۲ به 'روز کانادا' تغییر نام یافت. جشن‌ها معمولاً شامل آتش‌بازی، رژه، کنسرت و رویدادهای اجتماعی در سراسر کشور می‌شود." },
  "Civic Holiday (Ontario)": { summary: "تعطیلات شهری انتاریو", details: "تعطیل شهری در اولین دوشنبه ماه اوت در انتاریو و چند استان دیگر کانادا برگزار می‌شود. اگرچه در انتاریو تعطیل رسمی قانونی نیست، اما به‌طور گسترده رعایت می‌شود. این تعطیل در سراسر کانادا نام‌های مختلفی دارد: روز سیمکو در تورنتو (به نام جان گریوز سیمکو، اولین فرماندار بالای کانادا)، روز بریتیش کلمبیا، روز ساسکاچوان و روز میراث در آلبرتا. این روز یک استراحت میان‌تابستانی در گرم‌ترین ماه سال فراهم می‌کند." },
  "Labour Day (CA)": { summary: "روز کارگر در کانادا", details: "روز کارگر تعطیل رسمی کانادایی است که در اولین دوشنبه سپتامبر برگزار می‌شود. ریشه آن به اعتصاب اتحادیه چاپگران تورنتو برای هفته کاری ۵۸ ساعته در سال ۱۸۷۲ برمی‌گردد. مجمع صنوف تورنتو اولین رژه بزرگ کارگران را در ۱۵ آوریل ۱۸۷۲ سازماندهی کرد. در سال ۱۸۹۴، دولت کانادا رسماً روز کارگر را تعطیل ملی اعلام کرد. این روز دستاوردهای کارگران و جنبش کارگری را گرامی می‌دارد و اغلب پایان غیررسمی تابستان در کانادا محسوب می‌شود." },
  "National Day for Truth & Reconciliation": { summary: "روز ملی حقیقت و آشتی", details: "۳۰ سپتامبر از سال ۲۰۲۱ تعطیل رسمی فدرال در کانادا شد و به‌عنوان روز ملی حقیقت و آشتی شناخته می‌شود. این روز بازماندگان مدارس شبانه‌روزی و کودکانی که هرگز بازنگشتند را گرامی می‌دارد. این تاریخ با روز پیراهن نارنجی همزمان است که از داستان فیلیس وبستاد الهام گرفته شده — کسی که پیراهن نارنجی جدیدش در اولین روز مدرسه شبانه‌روزی از او گرفته شد. کمیسیون حقیقت و آشتی کانادا تجربیات بیش از ۱۵۰٬۰۰۰ کودک بومی را که در مدارس شبانه‌روزی نگه‌داری شده بودند مستند کرد. این روز برای تأمل و آموزش است — نه تبلیغات." },
  "Construction Safety Month": { summary: "ماه ایمنی ساخت‌وساز", details: "اکتبر به‌عنوان ماه ایمنی ساخت‌وساز در سراسر آمریکای شمالی شناخته می‌شود. این کمپین برای افزایش آگاهی درباره اهمیت ایمنی در یکی از خطرناک‌ترین صنایع ایجاد شده است. بر اساس آمار انجمن هیئت‌های غرامت کارگران کانادا، ساخت‌وساز همواره در رتبه‌های بالای آسیب‌ها و تلفات محل کار قرار دارد. کمپین یک‌ماهه بر محافظت در برابر سقوط، ایمنی تجهیزات، رعایت تجهیزات حفاظتی و هدف صفر حادثه تمرکز دارد." },
  "World Mental Health Day": { summary: "روز جهانی سلامت روان", details: "روز جهانی سلامت روان در ۱۰ اکتبر برگزار می‌شود و در سال ۱۹۹۲ توسط فدراسیون جهانی سلامت روان تأسیس شده و از حمایت سازمان بهداشت جهانی (WHO) برخوردار است. هر ساله یک موضوع خاص برای افزایش آگاهی درباره مسائل سلامت روان و بسیج حمایت از مراقبت‌های سلامت روان تعیین می‌شود. هدف این روز کاهش انگ، ترویج گفتگوی باز درباره چالش‌های سلامت روان و تشویق سرمایه‌گذاری در خدمات سلامت روان است. این روز برای آگاهی‌بخشی و حمایت است — نه تبلیغات." },
  "Thanksgiving (CA)": { summary: "روز شکرگزاری کانادا", details: "شکرگزاری کانادایی در دومین دوشنبه اکتبر برگزار می‌شود. ریشه آن به سال ۱۵۷۸ برمی‌گردد، زمانی که کاشف انگلیسی مارتین فروبیشر مراسمی در نیوفاندلند برای شکرگزاری از سلامت رسیدنش برگزار کرد. این سنت با جشن‌های برداشت اروپایی و جشن‌های بومی پاییزی ترکیب شد. در سال ۱۸۷۹ تعطیل ملی شد و از سال ۱۹۵۷ در دومین دوشنبه اکتبر ثابت شده است. برخلاف شکرگزاری آمریکایی (در نوامبر)، شکرگزاری کانادایی بیشتر با فصل سنتی برداشت اروپایی هماهنگ است." },
  "Halloween": { summary: "هالووین", details: "هالووین در ۳۱ اکتبر برگزار می‌شود و ریشه در جشن باستانی سلتی ساون (Samhain) دارد که پایان فصل برداشت و آغاز زمستان را نشان می‌داد. سلت‌ها باور داشتند در این شب مرز بین زندگان و مردگان محو می‌شود. با گسترش مسیحیت در سرزمین‌های سلتی، اول نوامبر روز همه مقدسین شد و ۳۱ اکتبر 'شب همه مقدسین' نام گرفت که سرانجام به 'هالووین' کوتاه شد. مهاجران ایرلندی و اسکاتلندی این سنت را در قرن نوزدهم به آمریکای شمالی آوردند، جایی که به جشن مدرن لباس‌پوشی، شیرینی‌خواهی و فانوس کدویی تبدیل شد." },
  "Remembrance Day (CA)": { summary: "روز یادبود کانادا", details: "روز یادبود در ۱۱ نوامبر برگزار می‌شود و پرسنل نظامی کانادایی که در جنگ‌ها و مأموریت‌های صلح‌بانی خدمت کرده و جان باخته‌اند را گرامی می‌دارد. این تاریخ پایان جنگ جهانی اول را نشان می‌دهد، زمانی که آتش‌بس در ساعت یازدهم روز یازدهم ماه یازدهم سال ۱۹۱۸ امضا شد. گل شقایق نماد یادبود شد، با الهام از شعر 'در مزارع فلاندرز' نوشته سرهنگ کانادایی جان مک‌کری در سال ۱۹۱۵. این روز برای یادبود و ادای احترام است — نه تبلیغات." },
  "Black Friday": { summary: "جمعه سیاه", details: "جمعه سیاه روز بعد از شکرگزاری آمریکایی است و به بزرگ‌ترین رویداد خرید سال در سراسر جهان تبدیل شده است. این اصطلاح اولین بار در دهه ۱۹۶۰ در فیلادلفیا برای توصیف ترافیک سنگین و هرج‌ومرج پس از شکرگزاری استفاده شد. بعداً به‌عنوان روزی بازتفسیر شد که خرده‌فروشان از 'قرمز بودن' (زیان) به 'سیاه بودن' (سود) منتقل می‌شوند. از دهه ۲۰۰۰، جمعه سیاه به سطح جهانی از جمله کانادا، بریتانیا و فراتر از آن گسترش یافته است." },
  "Small Business Saturday": { summary: "شنبه کسب‌وکارهای کوچک", details: "شنبه کسب‌وکارهای کوچک در سال ۲۰۱۰ توسط آمریکن اکسپرس در واکنش به جمعه سیاه و دوشنبه سایبری ایجاد شد و مصرف‌کنندگان را به خرید از کسب‌وکارهای محلی و مستقل تشویق می‌کند. این ابتکار در سال ۲۰۱۱ رسماً توسط سنای آمریکا به رسمیت شناخته شد. این روز اهمیت کسب‌وکارهای کوچک برای اقتصاد محلی را برجسته می‌کند — در کانادا و آمریکا، کسب‌وکارهای کوچک اکثریت قریب به اتفاق تمام کسب‌وکارها و بخش مهمی از اشتغال را تشکیل می‌دهند. این روز کارآفرینی، ریشه‌های اجتماعی و خدمات شخصی‌سازی‌شده را جشن می‌گیرد." },
  "Cyber Monday": { summary: "دوشنبه سایبری", details: "دوشنبه سایبری در سال ۲۰۰۵ توسط فدراسیون ملی خرده‌فروشی آمریکا ابداع شد تا افزایش خرید آنلاین در دوشنبه پس از شکرگزاری آمریکایی را توصیف کند. در ابتدا به این دلیل ایجاد شد که بسیاری از مصرف‌کنندگان پس از تعطیلات آخر هفته به محل کار برمی‌گشتند و با اینترنت سریع‌تر دفتر کار آنلاین خرید می‌کردند. دوشنبه سایبری از آن زمان به یکی از بزرگ‌ترین روزهای خرید آنلاین جهان تبدیل شده و بازتاب‌دهنده تغییر عظیم به سمت تجارت الکترونیک و خرده‌فروشی دیجیتال است." },
  "Christmas Day": { summary: "روز کریسمس", details: "روز کریسمس در ۲۵ دسامبر توسط میلیاردها نفر در سراسر جهان جشن گرفته می‌شود و تولد عیسی مسیح را یادبود می‌کند، اگرچه تاریخ دقیق تولد او مشخص نیست. انتخاب ۲۵ دسامبر احتمالاً تحت تأثیر جشن رومی ساتورنالیا و جشن‌های انقلاب زمستانی بوده است. سنن مدرن کریسمس — از جمله درخت کریسمس (از آلمان)، بابانوئل (بر اساس سنت نیکلاس) و هدیه‌دادن — طی قرن‌ها شکل گرفته و ترکیبی از آداب مسیحی، پاگان و سکولار از فرهنگ‌های مختلف هستند." },
  "New Year's Eve": { summary: "شب سال نو", details: "شب سال نو در ۳۱ دسامبر، آخرین روز سال تقویم گریگوری، جشن گرفته می‌شود. سنت جشن گرفتن گذار به سال جدید بیش از ۴۰۰۰ سال قدمت دارد و به بابل باستان برمی‌گردد که جشنی ۱۱ روزه به نام آکیتو برگزار می‌کرد. در سال ۴۶ قبل از میلاد، ژولیوس سزار تقویم ژولیانی را معرفی کرد و اول ژانویه را آغاز سال نو قرار داد. امروزه شب سال نو در سراسر جهان با آتش‌بازی، شمارش معکوس و دورهمی‌ها برگزار می‌شود. جشن‌های نمادین شامل میدان تایمز نیویورک، بندر سیدنی در استرالیا و شانزه‌لیزه در پاریس هستند." },
};

function EventCard({ event }: { event: CalendarEvent }) {
  const badge = regionBadge[event.region];
  const persianInfo = PERSIAN_EVENT_INFO[event.name];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(today.getFullYear(), event.month - 1, event.day);
  const isPast = eventDate < today;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
          <div className={cn("w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0", isPast ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400")}>
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
            <p className="text-xs text-muted-foreground">{event.contentTheme}</p>
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
              <div dir="rtl" className="space-y-2">
                <p className="font-semibold text-foreground text-right text-sm">📖 {persianInfo.summary}</p>
                <p className="text-sm text-muted-foreground text-right leading-relaxed">{persianInfo.details}</p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
