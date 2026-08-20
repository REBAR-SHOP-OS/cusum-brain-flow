import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

export interface AutomationConfig {
  id: string;
  company_id: string;
  automation_key: string;
  name: string;
  description: string | null;
  agent_name: string | null;
  tier: number;
  category: string;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
  total_runs: number;
  total_success: number;
  total_failed: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  automation_key: string;
  automation_name: string;
  agent_name: string | null;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  metadata: Record<string, unknown> | null;
}

export function useAutomationConfigs() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["automation-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_configs")
        .select("*")
        .order("tier", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as unknown as AutomationConfig[]) || [];
    },
  });

  const { data: recentRuns = [] } = useQuery({
    queryKey: ["automation-runs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as AutomationRun[]) || [];
    },
  });

  const toggleAutomation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("automation_configs")
        .update({ enabled, updated_at: new Date().toISOString() } as any)
        .eq("automation_key", key);
      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      qc.invalidateQueries({ queryKey: ["automation-configs"] });
      toast({ title: enabled ? "✅ Automation enabled" : "⏸️ Automation paused" });
    },
    onError: (err) => {
      toast({ title: "Failed to toggle", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const triggerAutomation = useMutation({
    mutationFn: async (key: string) => {
      const functionMap: Record<string, string> = {
        auto_approve_penny: "auto-approve-penny",
        ar_aging_escalation: "ar-aging-escalation",
        pipeline_lead_recycler: "pipeline-lead-recycler",
        quote_expiry_watchdog: "quote-expiry-watchdog",
        penny_auto_actions: "penny-auto-actions",
      };
      const fnName = functionMap[key];
      if (!fnName) throw new Error(`No edge function mapped for ${key}`);
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["automation-runs-recent"] });
      qc.invalidateQueries({ queryKey: ["automation-configs"] });
      toast({ title: "🚀 Automation triggered", description: JSON.stringify(data) });
    },
    onError: (err) => {
      toast({ title: "Trigger failed", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  return { configs, recentRuns, isLoading, toggleAutomation, triggerAutomation };
}
