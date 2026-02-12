import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface HumanTask {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  reason: string | null;
  impact: string | null;
  severity: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actions: any;
  status: string;
  dedupe_key: string | null;
  inputs_snapshot: any;
  snoozed_until: string | null;
  created_at: string;
}

export function useHumanTasks(agentCode: string) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["human-tasks", agentCode],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: agent } = await supabase
        .from("agents" as any)
        .select("id")
        .eq("code", agentCode)
        .single();

      if (!agent) return [];

      const { data, error } = await supabase
        .from("human_tasks" as any)
        .select("*")
        .eq("agent_id", (agent as any).id)
        .in("status", ["open"])
        .or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as unknown as HumanTask[];
    },
    refetchInterval: 60_000,
  });

  const actOnTask = useMutation({
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
          entity_type: "human_task",
          entity_id: id,
        });
      }

      await supabase
        .from("human_tasks" as any)
        .update({ status: "acted", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["human-tasks", agentCode] }),
  });

  const dismissTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("human_tasks" as any)
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["human-tasks", agentCode] }),
  });

  const snoozeTask = useMutation({
    mutationFn: async (id: string) => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("human_tasks" as any)
        .update({ status: "snoozed", snoozed_until: snoozedUntil })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["human-tasks", agentCode] }),
  });

  return { tasks, isLoading, actOnTask, dismissTask, snoozeTask };
}
