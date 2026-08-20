import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface AgentSuggestion {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  reason: string | null;
  impact: string | null;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  actions: any;
  status: string;
  category: string | null;
  created_at: string;
}

export function useAgentSuggestions(agentCode: string) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["agent-suggestions", agentCode],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get agent_id from code
      const { data: agent } = await supabase
        .from("agents" as any)
        .select("id")
        .eq("code", agentCode)
        .single();

      if (!agent) return [];

      const { data, error } = await supabase
        .from("suggestions" as any)
        .select("*")
        .eq("agent_id", (agent as any).id)
        .in("status", ["open", "new"])
        .or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as unknown as AgentSuggestion[];
    },
    refetchInterval: 60_000,
  });

  const actOnSuggestion = useMutation({
    mutationFn: async ({ id, actionType }: { id: string; actionType: string }) => {
      const { data: agent } = await supabase
        .from("agents" as any)
        .select("id")
        .eq("code", agentCode)
        .single();

      if (agent) {
        await supabase.from("agent_action_log" as any).insert({
          agent_id: (agent as any).id,
          user_id: user!.id,
          company_id: companyId,
          action_type: actionType,
          entity_type: "suggestion",
          entity_id: id,
        });
      }

      // Mark suggestion as acted so it disappears from all lists
      await supabase
        .from("suggestions" as any)
        .update({ status: "acted", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-suggestions", agentCode] }),
  });

  const dismissSuggestion = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("suggestions" as any)
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-suggestions", agentCode] }),
  });

  const snoozeSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("suggestions" as any)
        .update({ snoozed_until: snoozedUntil })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-suggestions", agentCode] }),
  });

  return { suggestions, isLoading, actOnSuggestion, dismissSuggestion, snoozeSuggestion };
}

const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function useAllAgentSuggestions() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["all-agent-suggestions"],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get all enabled agents
      const { data: agents } = await supabase
        .from("agents" as any)
        .select("id, code, name")
        .eq("enabled", true);

      if (!agents || agents.length === 0) return [];

      const agentMap = new Map<string, { code: string; name: string }>();
      for (const a of agents as any[]) {
        agentMap.set(a.id, { code: a.code, name: a.name });
      }

      const agentIds = Array.from(agentMap.keys());

      const { data, error } = await supabase
        .from("suggestions" as any)
        .select("*")
        .in("agent_id", agentIds)
        .in("status", ["open", "new"])
        .or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Attach agent info and sort by severity
      const enriched = ((data ?? []) as any[]).map((s) => ({
        ...s,
        agent_code: agentMap.get(s.agent_id)?.code ?? "unknown",
        agent_name: agentMap.get(s.agent_id)?.name ?? "Agent",
      })) as (AgentSuggestion & { agent_code: string; agent_name: string })[];

      enriched.sort((a, b) => {
        const sa = severityOrder[a.severity] ?? 2;
        const sb = severityOrder[b.severity] ?? 2;
        if (sa !== sb) return sa - sb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return enriched;
    },
    refetchInterval: 60_000,
  });

  const actOnSuggestion = useMutation({
    mutationFn: async ({ id, actionType }: { id: string; actionType: string }) => {
      await supabase.from("agent_action_log" as any).insert({
        agent_id: null,
        user_id: user!.id,
        company_id: companyId,
        action_type: actionType,
        entity_type: "suggestion",
        entity_id: id,
      });
      await supabase
        .from("suggestions" as any)
        .update({ status: "acted", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-agent-suggestions"] }),
  });

  const dismissSuggestion = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("suggestions" as any)
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-agent-suggestions"] }),
  });

  const snoozeSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("suggestions" as any)
        .update({ snoozed_until: snoozedUntil })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-agent-suggestions"] }),
  });

  const bulkDismiss = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) =>
        supabase.from("suggestions" as any)
          .update({ status: "dismissed", resolved_at: new Date().toISOString() })
          .eq("id", id)
      ));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-agent-suggestions"] }),
  });

  const bulkSnooze = useMutation({
    mutationFn: async (ids: string[]) => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await Promise.all(ids.map((id) =>
        supabase.from("suggestions" as any)
          .update({ snoozed_until: snoozedUntil })
          .eq("id", id)
      ));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-agent-suggestions"] }),
  });

  return { suggestions, isLoading, actOnSuggestion, dismissSuggestion, snoozeSuggestion, bulkDismiss, bulkSnooze };
}
