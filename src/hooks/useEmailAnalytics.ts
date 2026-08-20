import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmailAnalyticsData {
  dailyVolume: Array<{ date: string; inbound: number; outbound: number }>;
  totalEmails: number;
  totalInbound: number;
  totalOutbound: number;
  actionRequired: number;
  actionRequiredRate: number;
  categoryDistribution: Record<string, number>;
  topSenders: Array<{ sender: string; count: number }>;
}

const EMPTY: EmailAnalyticsData = {
  dailyVolume: [],
  totalEmails: 0,
  totalInbound: 0,
  totalOutbound: 0,
  actionRequired: 0,
  actionRequiredRate: 0,
  categoryDistribution: {},
  topSenders: [],
};

export function useEmailAnalytics(daysBack = 30) {
  const [analytics, setAnalytics] = useState<EmailAnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("email-analytics", {
          body: { daysBack },
        });
        if (error) throw error;
        setAnalytics(data as EmailAnalyticsData);
      } catch (err) {
        console.error("Email analytics error:", err);
        setAnalytics(EMPTY);
      }
      setLoading(false);
    };
    load();
  }, [daysBack]);

  return { analytics, loading };
}
