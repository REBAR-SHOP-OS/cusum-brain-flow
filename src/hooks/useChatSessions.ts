import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ChatSession {
  id: string;
  title: string;
  agent_name: string;
  agent_color: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMsg {
  id: string;
  session_id: string;
  role: "user" | "agent";
  content: string;
  agent_type: string | null;
  created_at: string;
}

// Agent name → color mapping
const agentColorMap: Record<string, string> = {
  Blitz: "bg-blue-500",
  Haven: "bg-purple-400",
  Tally: "bg-emerald-500",
  Gauge: "bg-orange-500",
  Forge: "bg-slate-500",
  Atlas: "bg-yellow-500",
  Relay: "bg-pink-400",
  Pixel: "bg-pink-500",
  Prism: "bg-teal-400",
  Rex: "bg-teal-500",
  Penny: "bg-purple-500",
  Ally: "bg-amber-500",
  Chase: "bg-red-500",
  Cal: "bg-sky-500",
};

export function getAgentColor(agentName: string): string {
  return agentColorMap[agentName] || "bg-primary";
}

// Agent type → display name mapping
const agentTypeNameMap: Record<string, string> = {
  sales: "Blitz",
  accounting: "Penny",
  legal: "Tally",
  support: "Haven",
  collections: "Chase",
  estimation: "Cal",
  social: "Pixel",
};

export function getAgentName(agentType: string): string {
  return agentTypeNameMap[agentType] || agentType;
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions((data as ChatSession[]) || []);
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (title: string, agentName: string): Promise<string | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            title: title.slice(0, 100),
            agent_name: agentName,
            agent_color: getAgentColor(agentName),
          })
          .select("id")
          .single();

        if (error) throw error;
        fetchSessions();
        return data.id;
      } catch (err) {
        console.error("Failed to create chat session:", err);
        return null;
      }
    },
    [user, fetchSessions]
  );

  const addMessage = useCallback(
    async (sessionId: string, role: "user" | "agent", content: string, agentType?: string) => {
      try {
        const { error } = await supabase.from("chat_messages").insert({
          session_id: sessionId,
          role,
          content,
          agent_type: agentType || null,
        });

        if (error) throw error;

        // Touch session updated_at
        await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (err) {
        console.error("Failed to save chat message:", err);
      }
    },
    []
  );

  const getSessionMessages = useCallback(async (sessionId: string): Promise<ChatMsg[]> => {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data as ChatMsg[]) || [];
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      return [];
    }
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const { error } = await supabase
          .from("chat_sessions")
          .delete()
          .eq("id", sessionId);

        if (error) throw error;
        fetchSessions();
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [fetchSessions]
  );

  return { sessions, loading, fetchSessions, createSession, addMessage, getSessionMessages, deleteSession };
}
