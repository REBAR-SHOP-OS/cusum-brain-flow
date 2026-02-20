import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

interface CallRecord {
  direction: string | null;
  received_at: string | null;
  metadata: unknown;
  from_address: string | null;
  to_address: string | null;
}

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

export function useCallAnalytics(daysBack = 30) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subDays(new Date(), daysBack).toISOString();
      const { data } = await supabase
        .from("communications")
        .select("direction, received_at, metadata, from_address, to_address")
        .eq("source", "ringcentral")
        .gte("received_at", since)
        .order("received_at", { ascending: false })
        .limit(1000);

      setCalls(
        (data || []).filter((r) => {
          const meta = r.metadata as Record<string, unknown> | null;
          return meta?.type === "call";
        }) as CallRecord[]
      );
      setLoading(false);
    };
    load();
  }, [daysBack]);

  const analytics: CallAnalyticsData = useMemo(() => {
    const dailyMap = new Map<string, { inbound: number; outbound: number }>();
    const outcomes: Record<string, number> = {};
    const callerCounts = new Map<string, number>();
    let totalDuration = 0;
    let missed = 0;

    for (const call of calls) {
      const meta = call.metadata as Record<string, unknown> | null;
      const dir = (call.direction || "inbound").toLowerCase();
      const date = call.received_at ? format(startOfDay(new Date(call.received_at)), "yyyy-MM-dd") : "unknown";

      if (!dailyMap.has(date)) dailyMap.set(date, { inbound: 0, outbound: 0 });
      const day = dailyMap.get(date)!;
      if (dir === "inbound") day.inbound++;
      else day.outbound++;

      const result = (meta?.result as string) || "Unknown";
      outcomes[result] = (outcomes[result] || 0) + 1;
      if (result === "Missed") missed++;

      const duration = (meta?.duration as number) || 0;
      totalDuration += duration;

      const phone = dir === "inbound" ? call.from_address || "Unknown" : call.to_address || "Unknown";
      callerCounts.set(phone, (callerCounts.get(phone) || 0) + 1);
    }

    const dailyVolume = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    const totalInbound = calls.filter((c) => (c.direction || "").toLowerCase() === "inbound").length;
    const totalOutbound = calls.length - totalInbound;

    const topCallers = Array.from(callerCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([phone, count]) => ({ phone, count }));

    return {
      dailyVolume,
      totalCalls: calls.length,
      totalInbound,
      totalOutbound,
      avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      missedCalls: missed,
      missedRate: calls.length > 0 ? Math.round((missed / calls.length) * 100) : 0,
      outcomeDistribution: outcomes,
      topCallers,
      totalDuration,
    };
  }, [calls]);

  return { analytics, loading };
}
