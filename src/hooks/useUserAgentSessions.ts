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
      // 1. Fetch assigned agents for this user
      const { data: assignedAgents, error: agentsError } = await supabase
        .from("user_agents")
        .select("agent_id, agents!inner(id, code, name)")
        .eq("user_id", userId!);

      if (agentsError) throw agentsError;

      // Build map of allowed agent names (agents.name is what chat_sessions.agent_name stores)
      const allowedAgentNames = new Map<string, string>();
      for (const ua of assignedAgents || []) {
        const agent = ua.agents as any;
        if (agent?.name) {
          allowedAgentNames.set(agent.name, agent.name);
        }
      }

      // If no agents assigned, return empty
      if (allowedAgentNames.size === 0) return [];

      const allowedNames = [...allowedAgentNames.keys()];

      // 2. Get sessions only for allowed agents
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, updated_at")
        .eq("user_id", userId!)
        .in("agent_name", allowedNames)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // 3. Group by agent_name
      const agentMap = new Map<string, { count: number; lastUsed: string; sessionIds: string[] }>();
      for (const s of sessions || []) {
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

      // 4. Build results — include assigned agents even with 0 sessions
      const results: AgentSessionSummary[] = [];

      for (const agentName of allowedNames) {
        const info = agentMap.get(agentName);

        if (info) {
          // Has sessions — fetch recent messages from latest
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
        } else {
          // Assigned but no sessions yet
          results.push({
            agentName,
            sessionCount: 0,
            lastUsed: "",
            recentMessages: [],
          });
        }
      }

      return results.sort((a, b) => {
        if (!a.lastUsed && !b.lastUsed) return 0;
        if (!a.lastUsed) return 1;
        if (!b.lastUsed) return -1;
        return b.lastUsed.localeCompare(a.lastUsed);
      });
    },
  });
}
