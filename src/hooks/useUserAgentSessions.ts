import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agentConfigs } from "@/components/agent/agentConfigs";

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
      // 1. Get all sessions for this user
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, updated_at")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // 2. Group sessions by agent_name
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

      // 3. Build a name lookup from agentConfigs (config name → config key)
      const allAgentNames = new Set<string>();
      for (const key of Object.keys(agentConfigs)) {
        allAgentNames.add(agentConfigs[key].name);
      }

      // Also include any agent_name from sessions that might not be in configs
      for (const name of agentMap.keys()) {
        allAgentNames.add(name);
      }

      // 4. Build results for all agents
      const results: AgentSessionSummary[] = [];

      for (const agentName of allAgentNames) {
        const info = agentMap.get(agentName);

        if (info) {
          // Agent has sessions — fetch recent messages
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
        } else {
          // Agent exists in configs but user hasn't used it yet
          results.push({
            agentName,
            sessionCount: 0,
            totalMessages: 0,
            lastUsed: "",
            recentMessages: [],
          });
        }
      }

      // Sort: active agents first (by last used desc), then inactive alphabetically
      return results.sort((a, b) => {
        if (a.sessionCount > 0 && b.sessionCount === 0) return -1;
        if (a.sessionCount === 0 && b.sessionCount > 0) return 1;
        if (a.sessionCount > 0 && b.sessionCount > 0) {
          return b.lastUsed.localeCompare(a.lastUsed);
        }
        return a.agentName.localeCompare(b.agentName);
      });
    },
  });
}
