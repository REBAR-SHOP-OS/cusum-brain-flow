import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentSessionSummary {
  agentName: string;
  sessionCount: number;
  lastUsed: string;
  recentMessages: { role: string; content: string; created_at: string }[];
}

export function useUserAgentSessions(userId: string | null) {
  return useQuery({
    queryKey: ["user_agent_sessions", userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<AgentSessionSummary[]> => {
      // Get all sessions for this user
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, updated_at")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!sessions?.length) return [];

      // Group by agent_name
      const agentMap = new Map<string, { count: number; lastUsed: string; sessionIds: string[] }>();
      for (const s of sessions) {
        const existing = agentMap.get(s.agent_name);
        if (existing) {
          existing.count++;
          existing.sessionIds.push(s.id);
        } else {
          agentMap.set(s.agent_name, {
            count: 1,
            lastUsed: s.updated_at,
            sessionIds: [s.id],
          });
        }
      }

      // For each agent, get last 3 messages from most recent session
      const results: AgentSessionSummary[] = [];
      for (const [agentName, info] of agentMap) {
        const latestSessionId = info.sessionIds[0];
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("session_id", latestSessionId)
          .order("created_at", { ascending: false })
          .limit(3);

        results.push({
          agentName,
          sessionCount: info.count,
          lastUsed: info.lastUsed,
          recentMessages: (msgs ?? []).reverse(),
        });
      }

      return results.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    },
  });
}
