import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";
import type { ActivityEvent } from "@/hooks/useUserActivityLog";
import type { ClockEntry } from "@/hooks/useUserPerformance";

export interface TeamMemberActivity {
  activities: ActivityEvent[];
  clockEntries: ClockEntry[];
  hoursToday: number;
  aiSessionsToday: number;
  emailsSent: number;
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

      const [actRes, clockRes, chatRes, commsRes] = await Promise.all([
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
        userIds.length > 0
          ? supabase
              .from("chat_sessions")
              .select("user_id")
              .in("user_id", userIds)
              .gte("created_at", dayStart)
              .lt("created_at", dayEnd)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0
          ? supabase
              .from("communications")
              .select("user_id")
              .in("user_id", userIds)
              .eq("direction", "outbound")
              .gte("created_at", dayStart)
              .lt("created_at", dayEnd)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Count AI sessions per user
      const aiSessionCounts: Record<string, number> = {};
      for (const row of chatRes.data ?? []) {
        const uid = (row as any).user_id as string;
        aiSessionCounts[uid] = (aiSessionCounts[uid] || 0) + 1;
      }

      // Count emails sent per user
      const emailCounts: Record<string, number> = {};
      for (const row of commsRes.data ?? []) {
        const uid = (row as any).user_id as string;
        emailCounts[uid] = (emailCounts[uid] || 0) + 1;
      }

      const result: Record<string, TeamMemberActivity> = {};
      for (const id of profileIds) {
        result[id] = { activities: [], clockEntries: [], hoursToday: 0, aiSessionsToday: 0, emailsSent: 0 };
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

      // Calculate hours & assign performance metrics
      for (const p of profiles) {
        const pid = p.id;
        const uid = p.user_id;
        if (!result[pid]) continue;

        // Hours from clock entries
        let totalMs = 0;
        for (const ce of result[pid].clockEntries) {
          const start = new Date(ce.clock_in).getTime();
          const end = ce.clock_out ? new Date(ce.clock_out).getTime() : Date.now();
          totalMs += end - start - (ce.break_minutes ?? 0) * 60000;
        }
        result[pid].hoursToday = Math.max(0, totalMs / 3600000);

        if (uid) {
          result[pid].aiSessionsToday = aiSessionCounts[uid] || 0;
          result[pid].emailsSent = emailCounts[uid] || 0;
        }
      }

      return result;
    },
  });
}
