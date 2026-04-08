import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";

export interface ClockEntry {
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  notes: string | null;
}

export interface UserPerformance {
  clockedIn: boolean;
  clockInTime: string | null;
  hoursToday: number;
  activitiesToday: number;
  aiSessionsToday: number;
  emailsSent: number;
  clockEntries: ClockEntry[];
}

export function useUserPerformance(profileId: string | null, userId: string | null, date?: Date) {
  const { timezone } = useWorkspaceSettings();

  const targetDate = date ?? new Date();
  const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

  return useQuery({
    queryKey: ["user_performance", profileId, userId, dayStart],
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<UserPerformance> => {

      // Parallel queries
      const [clockRes, activityRes, sessionsRes, commsRes] = await Promise.all([
        // Time clock entries today
        supabase
          .from("time_clock_entries")
          .select("clock_in, clock_out, break_minutes, notes")
          .eq("profile_id", profileId!)
          .gte("clock_in", dayStart)
          .lt("clock_in", dayEnd)
          .order("clock_in", { ascending: false }),

        // Activity events today
        supabase
          .from("activity_events")
          .select("id", { count: "exact", head: true })
          .eq("actor_id", userId || profileId!)
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd),

        // AI chat sessions today
        userId
          ? supabase
              .from("chat_sessions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("created_at", dayStart)
              .lt("created_at", dayEnd)
          : Promise.resolve({ count: 0, error: null }),

        // Communications sent today
        supabase
          .from("communications")
          .select("id", { count: "exact", head: true })
          .eq("direction", "outbound")
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd),
      ]);

      // Calculate hours today
      let hoursToday = 0;
      let clockedIn = false;
      let clockInTime: string | null = null;
      const clockEntries = clockRes.data ?? [];

      for (const entry of clockEntries) {
        const start = new Date(entry.clock_in).getTime();
        const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
        hoursToday += (end - start) / 3600000;
        if (!entry.clock_out && !clockedIn) {
          clockedIn = true;
          clockInTime = entry.clock_in;
        }
      }

      return {
        clockedIn,
        clockInTime,
        hoursToday: Math.round(hoursToday * 10) / 10,
        activitiesToday: activityRes.count ?? 0,
        aiSessionsToday: (sessionsRes as any).count ?? 0,
        emailsSent: commsRes.count ?? 0,
        clockEntries,
      };
    },
  });
}
