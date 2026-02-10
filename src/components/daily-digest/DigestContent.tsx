import { ThumbsUp, ThumbsDown, Calendar, Mail, Lightbulb, Sparkles, Video, Phone, TrendingUp, Zap, DollarSign, BarChart3, AlertTriangle, Share2, Users, Cog, Activity, Clock, FileText, RefreshCw, Layers, CheckCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { DigestData, DigestStats, BenCategory } from "@/hooks/useDailyDigest";

interface DigestContentProps {
  digest: DigestData;
  stats: DigestStats | null;
  currentDate: Date;
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const hasActivity = value > 0;
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 transition-colors ${accent && hasActivity ? "bg-destructive/10" : hasActivity ? "bg-primary/10" : "bg-muted/40"}`}>
      <span className={`text-xl font-bold tabular-nums ${accent && hasActivity ? "text-destructive" : hasActivity ? "text-primary" : "text-muted-foreground/60"}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}

const BEN_ICON_MAP: Record<string, React.ElementType> = {
  Mail, FileText, AlertTriangle, RefreshCw, Users, Layers, CheckCircle, Target,
};

function BenCategoryCard({ category }: { category: BenCategory }) {
  const IconComp = BEN_ICON_MAP[category.icon] || FileText;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
          <IconComp className="w-4 h-4 text-primary" />
          {category.title}
          {category.urgentCount > 0 && (
            <Badge variant="destructive" className="text-[10px] ml-1 px-1.5 py-0">{category.urgentCount} urgent</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-2">
        {category.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-sm text-foreground/80 leading-relaxed">{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DigestContent({ digest, stats, currentDate }: DigestContentProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Compact Date & Greeting Hero */}
      <div className="text-center space-y-3 pb-2">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 rounded-2xl flex items-center justify-center shadow-sm">
          <Zap className="w-9 h-9 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{format(currentDate, "EEEE, MMM d")}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{digest.greeting}</p>
        </div>
      </div>

      {/* Stats Grid - Ben-specific or generic */}
      {stats && digest.benCategories ? (
        <div className="grid grid-cols-4 gap-1.5">
          <StatPill label="Emails" value={stats.emails} />
          <StatPill label="Est. Ben" value={stats.estimatesBen ?? 0} />
          <StatPill label="QC Flags" value={stats.qcFlags ?? 0} accent />
          <StatPill label="Addendums" value={stats.addendums ?? 0} />
          <StatPill label="Est. Karthick" value={stats.estimatesKarthick ?? 0} />
          <StatPill label="Shop Dwg" value={stats.shopDrawings ?? 0} />
          <StatPill label="Approval" value={stats.pendingApproval ?? 0} accent />
          <StatPill label="Overdue" value={stats.overdueTasks ?? 0} accent />
        </div>
      ) : stats && (
        <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
          <StatPill label="Emails" value={stats.emails} />
          <StatPill label="Tasks" value={stats.tasks} />
          <StatPill label="Leads" value={stats.leads} />
          <StatPill label="Orders" value={stats.orders} />
          <StatPill label="WOs" value={stats.workOrders} />
          <StatPill label="Delivery" value={stats.deliveries} />
          <StatPill label="Meets" value={stats.meetings ?? 0} />
          <StatPill label="Calls" value={stats.phoneCalls ?? 0} />
          <StatPill label="Invoices" value={stats.invoices ?? 0} />
          <StatPill label="Overdue" value={stats.overdueInvoices ?? 0} accent />
          <StatPill label="Posts" value={stats.socialPosts ?? 0} />
          <StatPill label="Clocked" value={stats.employeesClocked ?? 0} />
          <StatPill label="Runs" value={stats.machineRuns ?? 0} />
          <StatPill label="ERP" value={stats.erpEvents ?? 0} />
          <StatPill label="Reports" value={stats.mailboxReports ?? 0} />
          <StatPill label="Pipeline" value={stats.leads} />
        </div>
      )}

      {/* Affirmation — subtle accent strip */}
      <div className="rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-border/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground italic leading-relaxed">{digest.affirmation}</p>
        </div>
      </div>

      {/* Key Takeaways */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            Key Takeaways
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <ol className="space-y-2.5">
            {digest.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-foreground/80 leading-relaxed">{takeaway}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Ben's 8 Categories */}
      {digest.benCategories && digest.benCategories.length > 0 && (
        <div className="space-y-4">
          {digest.benCategories.map((cat, i) => (
            <BenCategoryCard key={i} category={cat} />
          ))}
        </div>
      )}

      {/* Generic company sections — hidden when benCategories present */}
      {!digest.benCategories && (
        <>
          {/* Financial Snapshot */}
          {digest.financialSnapshot && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Financial Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.financialSnapshot.totalAR}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">A/R Balance</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${Number(digest.financialSnapshot.overdueCount) > 0 ? "bg-destructive/10" : "bg-muted/30"}`}>
                    <p className={`text-lg font-bold tabular-nums ${Number(digest.financialSnapshot.overdueCount) > 0 ? "text-destructive" : "text-foreground"}`}>
                      {digest.financialSnapshot.overdueCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.financialSnapshot.overdueAmount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Overdue Amt</p>
                  </div>
                </div>
                {digest.financialSnapshot.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/80">{h}</p>
                  </div>
                ))}
                {digest.financialSnapshot.cashFlowNote && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-emerald-500/30 pl-3">{digest.financialSnapshot.cashFlowNote}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Social Media Digest */}
          {digest.socialMediaDigest && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  Social Media (7-day)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.socialMediaDigest.totalReach}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Reach</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.socialMediaDigest.totalEngagement}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Engagement</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-primary capitalize">{digest.socialMediaDigest.topPlatform}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Top Platform</p>
                  </div>
                </div>
                {digest.socialMediaDigest.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/80">{h}</p>
                  </div>
                ))}
                {digest.socialMediaDigest.recommendations.length > 0 && (
                  <div className="border-l-2 border-blue-500/30 pl-3 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Recommendations</p>
                    {digest.socialMediaDigest.recommendations.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">⚡ {r}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employee Report */}
          {digest.employeeReport && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Employee Report
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.employeeReport.totalClocked}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Clocked In</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.employeeReport.totalHours}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Total Hours</p>
                  </div>
                </div>
                {digest.employeeReport.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Users className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/80">{h}</p>
                  </div>
                ))}
                {digest.employeeReport.concerns.length > 0 && (
                  <div className="border-l-2 border-destructive/30 pl-3 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">⚠️ Concerns</p>
                    {digest.employeeReport.concerns.map((c, i) => (
                      <p key={i} className="text-xs text-destructive/80">{c}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Production Report */}
          {digest.productionReport && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Cog className="w-4 h-4 text-cyan-500" />
                  Production Report
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.productionReport.totalRuns}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Runs</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-primary tabular-nums">{digest.productionReport.totalOutput}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Output</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums">{digest.productionReport.scrapRate}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Scrap %</p>
                  </div>
                </div>
                {digest.productionReport.topOperators.map((op, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-foreground/80">{op}</p>
                  </div>
                ))}
                {digest.productionReport.issues.length > 0 && (
                  <div className="border-l-2 border-destructive/30 pl-3 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">⚠️ Issues</p>
                    {digest.productionReport.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-destructive/80">{issue}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ERP Activity */}
          {digest.erpActivity && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Activity className="w-4 h-4 text-violet-500" />
                  ERP Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm font-bold text-foreground tabular-nums">{digest.erpActivity.totalEvents} <span className="text-xs font-normal text-muted-foreground">events logged</span></p>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{digest.erpActivity.summary}</p>
                {digest.erpActivity.mostActiveUsers.length > 0 && (
                  <div className="border-l-2 border-violet-500/30 pl-3 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Most Active Users</p>
                    {digest.erpActivity.mostActiveUsers.map((u, i) => (
                      <p key={i} className="text-xs text-foreground/70">👤 {u}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Emails Section */}
          {digest.emailCategories && digest.emailCategories.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Email Digest
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-5">
                {digest.emailCategories.map((category, catIndex) => (
                  <div key={catIndex} className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{category.category}</h4>
                    <div className="space-y-3 pl-3 border-l-2 border-blue-500/20">
                      {category.emails.map((email, emailIndex) => (
                        <div key={emailIndex} className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground/90">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">→ {email.summary}</p>
                          <p className="text-xs text-primary/80 font-medium">⚡ {email.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Meeting Summaries */}
          {digest.meetingSummaries && digest.meetingSummaries.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Video className="w-4 h-4 text-purple-500" />
                  Meetings
                  <Badge variant="secondary" className="text-[10px] ml-1">{digest.meetingSummaries.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {digest.meetingSummaries.map((meeting, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2 border border-border/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{meeting.title}</span>
                      <Badge variant="outline" className="text-[10px] h-4">{meeting.type}</Badge>
                      {meeting.duration && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{meeting.duration}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meeting.summary}</p>
                    {meeting.actionItems && meeting.actionItems.length > 0 && (
                      <div className="pl-3 border-l-2 border-purple-500/30 space-y-0.5">
                        {meeting.actionItems.map((item, j) => (
                          <p key={j} className="text-xs text-muted-foreground">• {item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Phone Calls */}
          {digest.phoneCalls && digest.phoneCalls.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Calls & SMS
                  <Badge variant="secondary" className="text-[10px] ml-1">{digest.phoneCalls.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2.5">
                {digest.phoneCalls.map((call, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-1 border border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{call.contact}</span>
                      <Badge variant={call.direction === "Inbound" ? "secondary" : "outline"} className="text-[10px] h-4">
                        {call.direction}
                      </Badge>
                      {call.duration && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{call.duration}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">→ {call.summary}</p>
                    <p className="text-xs text-primary/80 font-medium">⚡ {call.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Calendar */}
      {digest.calendarEvents && digest.calendarEvents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Calendar className="w-4 h-4 text-green-500" />
              Suggested Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {digest.calendarEvents.map((event, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 tabular-nums">{event.time}</Badge>
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.purpose}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tip of the Day */}
      {digest.tipOfTheDay && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Tip of the Day
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2.5">
            <p className="text-sm font-medium">{digest.tipOfTheDay.title}</p>
            <ol className="space-y-1.5 pl-1">
              {digest.tipOfTheDay.steps.map((step, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground italic pt-1">{digest.tipOfTheDay.closing}</p>
          </CardContent>
        </Card>
      )}

      {/* Random Fact */}
      {digest.randomFact && (
        <div className="rounded-xl bg-muted/30 border border-border/40 px-5 py-3.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/70">💡 Did you know? </span>
            {digest.randomFact}
          </p>
        </div>
      )}

      {/* Feedback — minimal */}
      <div className="flex items-center justify-center gap-3 py-4">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary">
            <ThumbsUp className="w-3 h-3" /> Yes
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive">
            <ThumbsDown className="w-3 h-3" /> No
          </Button>
        </div>
      </div>
    </div>
  );
}
