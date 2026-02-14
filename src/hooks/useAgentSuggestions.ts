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
