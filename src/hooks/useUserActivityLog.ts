import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";

export interface ActivityEvent {
  id: string;
  event_type: string;
  entity_type: string;
  description: string | null;
  created_at: string;
  source: string;
  metadata: Record<string, unknown> | null;
}

export function useUserActivityLog(profileId: string | null, userId?: string | null, date?: Date) {
  const { timezone } = useWorkspaceSettings();
  const actorId = userId || profileId;

  return useQuery({
    queryKey: ["user_activity_log", actorId, date?.toISOString() ?? "today"],
    enabled: !!actorId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<ActivityEvent[]> => {
      const targetDate = date ?? new Date();
      const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);

      // Compute end of day by getting start of next day
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

      const { data, error } = await supabase
        .from("activity_events")
        .select("id, event_type, entity_type, description, created_at, source, metadata")
        .eq("actor_id", actorId!)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as ActivityEvent[];
    },
  });
}
