import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DigestEmail {
  subject: string;
  summary: string;
  action: string;
}

export interface DigestEmailCategory {
  category: string;
  emails: DigestEmail[];
}

export interface DigestCalendarEvent {
  time: string;
  title: string;
  purpose: string;
}

export interface DigestTip {
  title: string;
  steps: string[];
  closing: string;
}

export interface DigestMeetingSummary {
  title: string;
  type: string;
  duration: string;
  summary: string;
  actionItems?: string[];
}

export interface DigestPhoneCall {
  contact: string;
  direction: string;
  duration: string;
  summary: string;
  action: string;
}

export interface DigestFinancialSnapshot {
  totalAR: string;
  overdueCount: string;
  overdueAmount: string;
  highlights: string[];
  cashFlowNote: string;
}

export interface DigestSocialMediaDigest {
  totalReach: string;
  totalEngagement: string;
  topPlatform: string;
  highlights: string[];
  recommendations: string[];
}

export interface DigestEmployeeReport {
  totalClocked: string;
  totalHours: string;
  highlights: string[];
  concerns: string[];
}

export interface DigestProductionReport {
  totalRuns: string;
  totalOutput: string;
  scrapRate: string;
  topOperators: string[];
  issues: string[];
}

export interface DigestErpActivity {
  totalEvents: string;
  mostActiveUsers: string[];
  summary: string;
}

export interface DigestAgentActivity {
  agent: string;
  interactions: number;
  tasksCreated: number;
  highlights: string[];
}

export interface DigestHumanActivity {
  name: string;
  agentsUsed: string[];
  totalCommands: number;
  highlights: string[];
}

export interface DigestAgentActivityReport {
  totalInteractions: string;
  agentBreakdown: DigestAgentActivity[];
  humanActivity: DigestHumanActivity[];
}

export interface BenCategory {
  title: string;
  icon: string;
  items: string[];
  urgentCount: number;
}

export interface DigestData {
  greeting: string;
  affirmation: string;
  keyTakeaways: string[];
  financialSnapshot?: DigestFinancialSnapshot;
  emailCategories: DigestEmailCategory[];
  meetingSummaries?: DigestMeetingSummary[];
  phoneCalls?: DigestPhoneCall[];
  socialMediaDigest?: DigestSocialMediaDigest;
  employeeReport?: DigestEmployeeReport;
  productionReport?: DigestProductionReport;
  erpActivity?: DigestErpActivity;
  agentActivityReport?: DigestAgentActivityReport;
  calendarEvents: DigestCalendarEvent[];
  tipOfTheDay: DigestTip;
  randomFact: string;
  benCategories?: BenCategory[];
}

export interface DigestStats {
  emails: number;
  tasks: number;
  leads: number;
  orders: number;
  workOrders: number;
  deliveries: number;
  meetings?: number;
  phoneCalls?: number;
  invoices?: number;
  overdueInvoices?: number;
  socialPosts?: number;
  employeesClocked?: number;
  machineRuns?: number;
  erpEvents?: number;
  mailboxReports?: number;
  agentInteractions?: number;
  // Ben-specific stats
  estimatesBen?: number;
  qcFlags?: number;
  addendums?: number;
  estimatesKarthick?: number;
  shopDrawings?: number;
  pendingApproval?: number;
  overdueTasks?: number;
}

export function useDailyDigest(date: Date) {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [stats, setStats] = useState<DigestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function fetchDigest() {
      setLoading(true);
      setError(null);

      try {
        const isoDate = date.toISOString().split("T")[0];
        const { data, error: fnError } = await supabase.functions.invoke(
          "daily-summary",
          { body: { date: isoDate, userEmail: user?.email } }
        );

        if (cancelled) return;

        if (fnError) {
          throw new Error(fnError.message || "Failed to fetch digest");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        setDigest(data.digest);
        setStats(data.stats);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDigest();
    return () => { cancelled = true; };
  }, [date.toISOString().split("T")[0], user?.email]);

  return { digest, stats, loading, error, refetch: () => {
    setDigest(null);
    setStats(null);
    setLoading(true);
    setError(null);
    const isoDate = date.toISOString().split("T")[0];
    supabase.functions.invoke("daily-summary", { body: { date: isoDate, userEmail: user?.email } })
      .then(({ data, error: fnError }) => {
        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);
        setDigest(data.digest);
        setStats(data.stats);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }};
}
