import { ThumbsUp, ThumbsDown, Calendar, Mail, Lightbulb, Sparkles } from "lucide-react";
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

export function DigestContent({ digest, stats, currentDate }: DigestContentProps) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Mascot & Date Header */}
      <div className="text-center space-y-4">
        <div className="w-48 h-48 mx-auto bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 rounded-full flex items-center justify-center">
          <div className="text-6xl">🧑‍🚀</div>
        </div>
        <h2 className="text-2xl font-bold">{format(currentDate, "MMM d, yyyy")}</h2>
        <p className="text-muted-foreground">{digest.greeting}</p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: "Emails", value: stats.emails },
            { label: "Tasks", value: stats.tasks },
            { label: "Leads", value: stats.leads },
            { label: "Orders", value: stats.orders },
            { label: "Work Orders", value: stats.workOrders },
            { label: "Deliveries", value: stats.deliveries },
          ].map((s) => (
            <Card key={s.label} className="text-center">
              <CardContent className="py-3 px-2">
                <p className="text-2xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Daily Affirmation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Daily Affirmation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{digest.affirmation}</p>
        </CardContent>
      </Card>

      {/* Key Takeaways */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Key Takeaways</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {digest.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-semibold text-primary shrink-0">{i + 1}.</span>
                <span className="text-muted-foreground">{takeaway}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Emails Section */}
      {digest.emailCategories && digest.emailCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Emails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {digest.emailCategories.map((category, catIndex) => (
              <div key={catIndex} className="space-y-3">
                <h4 className="font-semibold text-sm">{category.category}</h4>
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  {category.emails.map((email, emailIndex) => (
                    <div key={emailIndex} className="space-y-1">
                      <p className="font-medium text-sm">{email.subject}</p>
                      <p className="text-xs text-muted-foreground">• Issue: {email.summary}</p>
                      <p className="text-xs text-muted-foreground">• Action: {email.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      {digest.calendarEvents && digest.calendarEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-500" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium mb-3">Today's Events:</p>
            <div className="space-y-3">
              {digest.calendarEvents.map((event, i) => (
                <div key={i} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{event.time}</Badge>
                    <span className="font-medium text-sm">{event.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{event.purpose}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips of the Day */}
      {digest.tipOfTheDay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Tips of the Day
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium text-sm">{digest.tipOfTheDay.title}</p>
            <ol className="space-y-2 pl-4">
              {digest.tipOfTheDay.steps.map((step, i) => (
                <li key={i} className="text-sm text-muted-foreground list-decimal">
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground italic">{digest.tipOfTheDay.closing}</p>
          </CardContent>
        </Card>
      )}

      {/* Random Facts */}
      {digest.randomFact && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Random Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{digest.randomFact}</p>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">Do you like this summary?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
