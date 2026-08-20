import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { getStartOfDayIsoInTimezone } from "@/lib/dateConfig";

export interface AgentUserBreakdown {
  userId: string;
  fullName: string;
  sessions: number;
  messages: number;
}

export interface SystemAgentSummary {
  agentName: string;
  totalSessions: number;
  totalMessages: number;
  userCount: number;
  lastUsed: string;
  users: AgentUserBreakdown[];
}

export function useSystemAgentSessions(date?: Date) {
  const { timezone } = useWorkspaceSettings();

  const targetDate = date ?? new Date();
  const dayStart = getStartOfDayIsoInTimezone(timezone, targetDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = getStartOfDayIsoInTimezone(timezone, nextDay);

  return useQuery({
    queryKey: ["system_agent_sessions", dayStart],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SystemAgentSummary[]> => {
      // Fetch all sessions for this date
      const { data: sessions, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_name, user_id, updated_at")
        .gte("updated_at", dayStart)
        .lt("updated_at", dayEnd)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      // Fetch profiles for user names
      const userIds = [...new Set(sessions.map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map<string, string>();
      for (const p of profiles || []) {
        profileMap.set(p.user_id, p.full_name || "Unknown");
      }

      // Group sessions by agent_name
      const agentMap = new Map<
        string,
        { sessionIds: string[]; lastUsed: string; userSessions: Map<string, number> }
      >();

      for (const s of sessions) {
        const name = s.agent_name;
        let entry = agentMap.get(name);
        if (!entry) {
          entry = { sessionIds: [], lastUsed: s.updated_at, userSessions: new Map() };
          agentMap.set(name, entry);
        }
        entry.sessionIds.push(s.id);
        entry.userSessions.set(s.user_id, (entry.userSessions.get(s.user_id) || 0) + 1);
      }

      // Count messages per session in bulk (batch all session IDs)
      const allSessionIds = sessions.map((s) => s.id);
      const { data: msgCounts } = await supabase
        .from("chat_messages")
        .select("session_id")
        .in("session_id", allSessionIds)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      // Build session → message count map
      const sessionMsgCount = new Map<string, number>();
      for (const m of msgCounts || []) {
        sessionMsgCount.set(m.session_id, (sessionMsgCount.get(m.session_id) || 0) + 1);
      }

      const results: SystemAgentSummary[] = [];

      for (const [agentName, info] of agentMap.entries()) {
        const totalMessages = info.sessionIds.reduce(
          (sum, sid) => sum + (sessionMsgCount.get(sid) || 0),
          0
        );

        // Build per-user breakdown
        const users: AgentUserBreakdown[] = [];
        for (const [uid, sessionCount] of info.userSessions.entries()) {
          // Count messages for this user's sessions with this agent
          const userSessionIds = sessions
            .filter((s) => s.user_id === uid && s.agent_name === agentName)
            .map((s) => s.id);
          const userMsgs = userSessionIds.reduce(
            (sum, sid) => sum + (sessionMsgCount.get(sid) || 0),
            0
          );

          users.push({
            userId: uid,
            fullName: profileMap.get(uid) || "Unknown",
            sessions: sessionCount,
            messages: userMsgs,
          });
        }

        users.sort((a, b) => b.messages - a.messages);

        results.push({
          agentName,
          totalSessions: info.sessionIds.length,
          totalMessages: totalMessages,
          userCount: info.userSessions.size,
          lastUsed: info.lastUsed,
          users,
        });
      }

      return results.sort((a, b) => b.totalMessages - a.totalMessages);
    },
  });
}
