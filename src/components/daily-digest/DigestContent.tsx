import { ThumbsUp, ThumbsDown, Calendar, Mail, Lightbulb, Sparkles, Video, Phone, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { DigestData, DigestStats } from "@/hooks/useDailyDigest";

interface DigestContentProps {
  digest: DigestData;
  stats: DigestStats | null;
  currentDate: Date;
}

function StatPill({ label, value }: { label: string; value: number }) {
  const hasActivity = value > 0;
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 transition-colors ${hasActivity ? "bg-primary/10" : "bg-muted/40"}`}>
      <span className={`text-xl font-bold tabular-nums ${hasActivity ? "text-primary" : "text-muted-foreground/60"}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    </div>
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

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          <StatPill label="Emails" value={stats.emails} />
          <StatPill label="Tasks" value={stats.tasks} />
          <StatPill label="Leads" value={stats.leads} />
          <StatPill label="Orders" value={stats.orders} />
          <StatPill label="WOs" value={stats.workOrders} />
          <StatPill label="Delivery" value={stats.deliveries} />
          <StatPill label="Meets" value={stats.meetings ?? 0} />
          <StatPill label="Calls" value={stats.phoneCalls ?? 0} />
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
