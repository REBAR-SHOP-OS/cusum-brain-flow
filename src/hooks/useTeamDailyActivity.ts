import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";
import type { ActivityEvent } from "@/hooks/useUserActivityLog";
import type { ClockEntry } from "@/hooks/useUserPerformance";

export interface TeamMemberActivity {
  activities: ActivityEvent[];
  clockEntries: ClockEntry[];
}

export function useTeamDailyActivity(profileIds: string[]) {
  const { timezone } = useWorkspaceSettings();

  return useQuery({
    queryKey: ["team_daily_activity", profileIds],
    enabled: profileIds.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<Record<string, TeamMemberActivity>> => {
      const todayStart = getStartOfDayIsoInTimezone(timezone);

      const [actRes, clockRes] = await Promise.all([
        supabase
          .from("activity_events")
          .select("id, event_type, entity_type, description, created_at, source, actor_id")
          .in("actor_id", profileIds)
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("time_clock_entries")
          .select("profile_id, clock_in, clock_out")
          .in("profile_id", profileIds)
          .gte("clock_in", todayStart)
          .order("clock_in", { ascending: false }),
      ]);

      const result: Record<string, TeamMemberActivity> = {};
      for (const id of profileIds) {
        result[id] = { activities: [], clockEntries: [] };
      }

      for (const row of actRes.data ?? []) {
        const pid = (row as any).actor_id as string;
        if (result[pid]) {
          result[pid].activities.push({
            id: row.id,
            event_type: row.event_type,
            entity_type: row.entity_type,
            description: row.description,
            created_at: row.created_at,
            source: row.source,
          });
        }
      }

      for (const row of clockRes.data ?? []) {
        const pid = (row as any).profile_id as string;
        if (result[pid]) {
          result[pid].clockEntries.push({
            clock_in: row.clock_in,
            clock_out: row.clock_out,
          });
        }
      }

      return result;
    },
  });
}
