import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Calendar, Mail, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subDays, addDays } from "date-fns";

interface DigestSection {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

// Sample digest data - in production this would come from AI/backend
const sampleDigest = {
  date: new Date(2026, 1, 4), // Feb 4, 2026
  greeting: "Hello, Sattar! 👋 Here's your Balanced Daily Digest for February 4, 2026.",
  affirmation: "I lead with clarity and systems. Every day I make Rebar.shop faster, sharper, and more reliable. 💪",
  keyTakeaways: [
    "High-value bid pipeline is active: multiple school/public works projects (Mount Hope ES, Ceylon Salt Depot, St Albert, Elizabeth Ziegler) need clear bid/no-bid decisions and estimating follow-up this week. 📑",
    "Sales team (especially Saurabh) is aggressively quoting and tightening specs with customers (Padres Phase 3 cages, Midland, Lantern, Steel Art Signs, ET Construction, Durham, CON-FRAME) — support them by unblocking any pricing/production constraints. 🔧",
    "IT/web stack has several alerts: Elementor fatal error on ontariosteelservices.ca, upcoming WP auto-updates, and SiteGround security gaps — these need a quick owner and a 3–5 step mitigation plan. 🔐",
    "Cash & compliance touchpoints: Sun Life premium bounce needs resolution, Interac transfer of $200 received, and OpenAI model retirement email signals that SattarOS/GPT-based workflows should be checked and updated. 💵🤖",
    "Continue tightening sales-to-ops loop: several customers asking about lead times and turnaround; reinforce the 2–3 business day standard where realistic and ensure Odoo/CRM notes match shop capacity. 🚚"
  ],
  emailCategories: [
    {
      category: "Critical IT / Security / Platform 🖥️🔐",
      emails: [
        {
          subject: "WordPress fatal error – ontariosteelservices.ca",
          summary: "Elementor Beta (Developer Edition) plugin throwing a fatal error (undefined constant) on WP 6.9.1.",
          action: "Assign dev or host support to: (a) log in with the recovery-mode link, (b) disable Elementor Beta, (c) either roll back or replace with stable Elementor, (d) confirm site is loading and error logs are clean."
        },
        {
          subject: "SiteGround auto-update notice (WordPress 6.9.1)",
          summary: "Risk: Plugin/theme breakage if autoupdate runs on a misaligned stack.",
          action: "Decide policy: either lock major sites to manual updates or ensure staging is updated and tested before production."
        },
        {
          subject: "SiteGround monthly security report for rebar.online",
          summary: "Score: 64.15% – main gaps: no malware scanner, no 2FA, partial backups, outdated plugins.",
          action: "Enable 2FA on the hosting account. Update/remove old plugins/themes. Confirm backup policy."
        }
      ]
    },
    {
      category: "Sales / CRM / Operations – HOT / TIME-SENSITIVE 📞📦",
      emails: [
        {
          subject: "RingCentral + Odoo + email trail – Saurabh's pipeline",
          summary: "Multiple BuildingConnected notices with addendum 01 & 02; bid due Feb 10, 2026.",
          action: "Confirm an estimator owner on each BuildingConnected RFP. Make sure bid/no-bid is clicked in BuildingConnected and mirrored in Odoo CRM stages."
        },
        {
          subject: "Quotes and Spec Adjustments – Padres Phase 3 & others",
          summary: "S02567 (Padres Phase 3 rebar cages, $1,389.90) – updated cage to 9\" dia, 51\" straight per engineering.",
          action: "Confirm that the 2–3 business day promise is realistic at current shop load (15 tons/day, 60% utilization)."
        }
      ]
    },
    {
      category: "Finance / Admin / HR 💵📑",
      emails: [
        {
          subject: "Interac e‑Transfer: +$200.00 deposited",
          summary: "Likely internal/expense or vendor payment.",
          action: "Ensure it's reconciled in QuickBooks/Odoo to avoid small variances."
        },
        {
          subject: "Sun Life contract (306658) – returned January premium",
          summary: "January PAD returned for NSF; February withdrawal will include January amount.",
          action: "Make sure Vicky has the green light on how to clear this (priority vs other payables)."
        }
      ]
    }
  ],
  calendarEvents: [
    {
      time: "3:00 PM – 3:30 PM",
      title: "Daily Command Report Review 🧠📊",
      purpose: "Generate and review the unified daily operations report for you (Sattar) – sales, RFQs, bids, production, deliveries, and key exceptions."
    }
  ],
  tipOfTheDay: {
    title: "Turn the bid/inquiry chaos into a simple control panel. 🧩",
    steps: [
      "Make a one-page \"Bid Heatmap\" for the next 30 days with columns: Project, Customer, Location, Bid Due, Scope, Estimator, Status, Est. Value.",
      "Have your team fill it from today's BuildingConnected + CRM emails.",
      "During your 3:00 PM Command Report Review, only look at this heatmap + top 5 live RFQs.",
      "Decide: (a) which 3–5 bids to prioritize this week, (b) which to politely decline, (c) which need install partners.",
      "Push decisions back into CRM stages so SattarOS agents can auto-follow-up, not chase you."
    ],
    closing: "This keeps you in CEO mode: steering volume and focus, not manually reading every thread. 🚀"
  },
  randomFact: "Asthma affects one in fifteen children under the age of eighteen"
};

export default function DailySummarizer() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(sampleDigest.date);

  const goToPreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/integrations")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Daily Summarizer</h1>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentDate, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextDay}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Mascot & Date Header */}
          <div className="text-center space-y-4">
            {/* Mascot placeholder - golden astronaut character */}
            <div className="w-48 h-48 mx-auto bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 rounded-full flex items-center justify-center">
              <div className="text-6xl">🧑‍🚀</div>
            </div>

            <h2 className="text-2xl font-bold">{format(currentDate, "MMM d, yyyy")}</h2>
            <p className="text-muted-foreground">{sampleDigest.greeting}</p>
          </div>

          {/* Daily Affirmation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Daily Affirmation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground italic">{sampleDigest.affirmation}</p>
            </CardContent>
          </Card>

          {/* Key Takeaways */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Key Takeaways</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {sampleDigest.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-semibold text-primary shrink-0">{i + 1}.</span>
                    <span className="text-muted-foreground">{takeaway}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Emails Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Emails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Here's a concise rundown of the most important emails and what they imply for you 👇
              </p>

              {sampleDigest.emailCategories.map((category, catIndex) => (
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

          {/* Calendar */}
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
                {sampleDigest.calendarEvents.map((event, i) => (
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

          {/* Tips of the Day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Tips of the Day
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium text-sm">{sampleDigest.tipOfTheDay.title}</p>
              <ol className="space-y-2 pl-4">
                {sampleDigest.tipOfTheDay.steps.map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground italic">{sampleDigest.tipOfTheDay.closing}</p>
            </CardContent>
          </Card>

          {/* Random Facts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Random Facts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{sampleDigest.randomFact}</p>
            </CardContent>
          </Card>

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
      </ScrollArea>
    </div>
  );
}
