import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CallAnalyticsData {
  dailyVolume: Array<{ date: string; inbound: number; outbound: number }>;
  totalCalls: number;
  totalInbound: number;
  totalOutbound: number;
  avgDuration: number;
  missedCalls: number;
  missedRate: number;
  outcomeDistribution: Record<string, number>;
  topCallers: Array<{ phone: string; count: number }>;
  totalDuration: number;
}

const EMPTY: CallAnalyticsData = {
  dailyVolume: [],
  totalCalls: 0,
  totalInbound: 0,
  totalOutbound: 0,
  avgDuration: 0,
  missedCalls: 0,
  missedRate: 0,
  outcomeDistribution: {},
  topCallers: [],
  totalDuration: 0,
};

export function useCallAnalytics(daysBack = 30) {
  const [analytics, setAnalytics] = useState<CallAnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ringcentral-call-analytics", {
          body: { daysBack },
        });
        if (error) throw error;
        setAnalytics(data as CallAnalyticsData);
      } catch (err) {
        console.error("Call analytics error:", err);
        setAnalytics(EMPTY);
      }
      setLoading(false);
    };
    load();
  }, [daysBack]);

  return { analytics, loading };
}
