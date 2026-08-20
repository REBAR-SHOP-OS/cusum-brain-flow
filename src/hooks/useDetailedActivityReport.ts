import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";
import type { ActivityEvent } from "@/hooks/useUserActivityLog";

export interface ActivityBreakdown {
  eventType: string;
  count: number;
}

export interface EntityBreakdown {
  entityType: string;
  count: number;
}

export interface HourlyGroup {
  hour: number;
  label: string;
  events: ActivityEvent[];
}

export interface DetailedActivityReport {
  allEvents: ActivityEvent[];
  totalCount: number;
  byEventType: ActivityBreakdown[];
  byEntityType: EntityBreakdown[];
  hourlyGroups: HourlyGroup[];
  mostActiveHour: string | null;
}

export function useDetailedActivityReport(
  userId: string | null | undefined,
  date?: Date
) {
  const { timezone } = useWorkspaceSettings();

  const targetDate = date ?? new Date();
  const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

  return useQuery({
    queryKey: ["detailed_activity_report", userId, dayStart],
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<DetailedActivityReport> => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("id, event_type, entity_type, description, created_at, source, metadata")
        .eq("actor_id", userId!)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      const events = (data ?? []) as ActivityEvent[];

      // Group by event_type
      const eventMap: Record<string, number> = {};
      const entityMap: Record<string, number> = {};
      const hourMap: Record<number, ActivityEvent[]> = {};

      for (const ev of events) {
        eventMap[ev.event_type] = (eventMap[ev.event_type] || 0) + 1;
        entityMap[ev.entity_type] = (entityMap[ev.entity_type] || 0) + 1;

        const hour = new Date(ev.created_at).getHours();
        if (!hourMap[hour]) hourMap[hour] = [];
        hourMap[hour].push(ev);
      }

      const byEventType = Object.entries(eventMap)
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((a, b) => b.count - a.count);

      const byEntityType = Object.entries(entityMap)
        .map(([entityType, count]) => ({ entityType, count }))
        .sort((a, b) => b.count - a.count);

      const hourlyGroups: HourlyGroup[] = Object.entries(hourMap)
        .map(([h, evts]) => {
          const hour = Number(h);
          const ampm = hour >= 12 ? "PM" : "AM";
          const h12 = hour % 12 || 12;
          return { hour, label: `${h12}:00 ${ampm}`, events: evts };
        })
        .sort((a, b) => a.hour - b.hour);

      let mostActiveHour: string | null = null;
      if (hourlyGroups.length > 0) {
        const max = hourlyGroups.reduce((a, b) =>
          b.events.length > a.events.length ? b : a
        );
        mostActiveHour = max.label;
      }

      return {
        allEvents: events,
        totalCount: events.length,
        byEventType,
        byEntityType,
        hourlyGroups,
        mostActiveHour,
      };
    },
  });
}
