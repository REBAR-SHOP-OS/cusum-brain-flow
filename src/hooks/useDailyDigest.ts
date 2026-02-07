import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export interface DigestData {
  greeting: string;
  affirmation: string;
  keyTakeaways: string[];
  emailCategories: DigestEmailCategory[];
  meetingSummaries?: DigestMeetingSummary[];
  phoneCalls?: DigestPhoneCall[];
  calendarEvents: DigestCalendarEvent[];
  tipOfTheDay: DigestTip;
  randomFact: string;
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
}

export function useDailyDigest(date: Date) {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [stats, setStats] = useState<DigestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDigest() {
      setLoading(true);
      setError(null);

      try {
        const isoDate = date.toISOString().split("T")[0];
        const { data, error: fnError } = await supabase.functions.invoke(
          "daily-summary",
          { body: { date: isoDate } }
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
  }, [date.toISOString().split("T")[0]]);

  return { digest, stats, loading, error, refetch: () => {
    setDigest(null);
    setStats(null);
    setLoading(true);
    setError(null);
    const isoDate = date.toISOString().split("T")[0];
    supabase.functions.invoke("daily-summary", { body: { date: isoDate } })
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
