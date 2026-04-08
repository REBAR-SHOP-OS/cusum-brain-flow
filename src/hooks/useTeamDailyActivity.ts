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

interface ProfileSlim {
  id: string;
  user_id: string | null;
}

export function useTeamDailyActivity(profiles: ProfileSlim[], date?: Date) {
  const { timezone } = useWorkspaceSettings();

  const targetDate = date ?? new Date();
  const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

  const profileIds = profiles.map((p) => p.id);

  return useQuery({
    queryKey: ["team_daily_activity", profileIds, dayStart],
    enabled: profiles.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<Record<string, TeamMemberActivity>> => {
      // Build userId → profileId map
      const userIdToProfileId: Record<string, string> = {};
      const userIds: string[] = [];
      for (const p of profiles) {
        if (p.user_id) {
          userIdToProfileId[p.user_id] = p.id;
          userIds.push(p.user_id);
        }
      }

      const [actRes, clockRes] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from("activity_events")
              .select("id, event_type, entity_type, description, created_at, source, actor_id")
              .in("actor_id", userIds)
              .gte("created_at", dayStart)
              .lt("created_at", dayEnd)
              .order("created_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("time_clock_entries")
          .select("profile_id, clock_in, clock_out")
          .in("profile_id", profileIds)
          .gte("clock_in", dayStart)
          .lt("clock_in", dayEnd)
          .order("clock_in", { ascending: false }),
      ]);

      const result: Record<string, TeamMemberActivity> = {};
      for (const id of profileIds) {
        result[id] = { activities: [], clockEntries: [] };
      }

      for (const row of actRes.data ?? []) {
        const actorId = (row as any).actor_id as string;
        const pid = userIdToProfileId[actorId];
        if (pid && result[pid]) {
          result[pid].activities.push({
            id: row.id,
            event_type: row.event_type,
            entity_type: row.entity_type,
            description: row.description,
            created_at: row.created_at,
            source: row.source,
            metadata: (row as any).metadata ?? null,
          });
        }
      }

      for (const row of clockRes.data ?? []) {
        const pid = (row as any).profile_id as string;
        if (result[pid]) {
          result[pid].clockEntries.push({
            clock_in: row.clock_in,
            clock_out: row.clock_out,
            break_minutes: (row as any).break_minutes ?? 0,
            notes: (row as any).notes ?? null,
          });
        }
      }

      return result;
    },
  });
}
