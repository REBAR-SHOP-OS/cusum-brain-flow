import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";

export interface AgentSessionSummary {
  agentName: string;
  sessionCount: number;
  totalMessages: number;
  lastUsed: string;
  recentMessages: { role: string; content: string; created_at: string }[];
}

export function useUserAgentSessions(userId: string | null, date?: Date) {
  const { timezone } = useWorkspaceSettings();

  const targetDate = date ?? new Date();
  const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

  return useQuery({
    queryKey: ["user_agent_sessions", userId, dayStart],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AgentSessionSummary[]> => {
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, updated_at")
        .eq("user_id", userId!)
        .gte("updated_at", dayStart)
        .lt("updated_at", dayEnd)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Normalize legacy agent names to canonical display names
      const AGENT_NAME_ALIASES: Record<string, string> = {
        eisenhower: "Eisenhower Matrix",
      };

      const agentMap = new Map<string, { count: number; lastUsed: string; sessionIds: string[] }>();
      for (const s of (sessions || [])) {
        const normalizedName = AGENT_NAME_ALIASES[s.agent_name] ?? s.agent_name;
        const existing = agentMap.get(normalizedName);
        if (existing) {
          existing.count++;
          existing.sessionIds.push(s.id);
        } else {
          agentMap.set(normalizedName, {
            count: 1,
            lastUsed: s.updated_at,
            sessionIds: [s.id],
          });
        }
      }

      const results: AgentSessionSummary[] = [];

      for (const [agentName, info] of agentMap.entries()) {
        const latestSessionId = info.sessionIds[0];
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("session_id", latestSessionId)
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd)
          .order("created_at", { ascending: false })
          .limit(10);

        const { count: totalMsgCount } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .in("session_id", info.sessionIds)
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd);

        results.push({
          agentName,
          sessionCount: info.count,
          totalMessages: totalMsgCount ?? 0,
          lastUsed: info.lastUsed,
          recentMessages: (msgs ?? []).reverse(),
        });
      }

      return results.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    },
  });
}
