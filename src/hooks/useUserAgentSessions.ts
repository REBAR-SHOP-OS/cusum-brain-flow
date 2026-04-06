import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentSessionSummary {
  agentName: string;
  sessionCount: number;
  totalMessages: number;
  lastUsed: string;
  recentMessages: { role: string; content: string; created_at: string }[];
}

export function useUserAgentSessions(userId: string | null) {
  return useQuery({
    queryKey: ["user_agent_sessions", userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<AgentSessionSummary[]> => {
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, updated_at")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const agentMap = new Map<string, { count: number; lastUsed: string; sessionIds: string[] }>();
      for (const s of (sessions || [])) {
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

      const results: AgentSessionSummary[] = [];

      for (const [agentName, info] of agentMap.entries()) {
        const latestSessionId = info.sessionIds[0];
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("session_id", latestSessionId)
          .order("created_at", { ascending: false })
          .limit(10);

        const { count: totalMsgCount } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .in("session_id", info.sessionIds);

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
