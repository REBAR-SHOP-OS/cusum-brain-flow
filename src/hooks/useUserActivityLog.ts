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
}

export function useUserActivityLog(profileId: string | null) {
  const { timezone } = useWorkspaceSettings();

  return useQuery({
    queryKey: ["user_activity_log", profileId],
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<ActivityEvent[]> => {
      const todayStart = getStartOfDayIsoInTimezone(timezone);

      const { data, error } = await supabase
        .from("activity_events")
        .select("id, event_type, entity_type, description, created_at, source")
        .eq("actor_id", profileId!)
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as ActivityEvent[];
    },
  });
}
