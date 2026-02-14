import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface EmailAutomation {
  id: string;
  automation_key: string;
  name: string;
  description: string;
  trigger_type: string;
  campaign_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  priority: string;
  company_id: string;
  last_triggered_at: string | null;
  campaigns_generated: number;
  created_at: string;
  updated_at: string;
}

export function useEmailAutomations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["email_automations"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EmailAutomation[];
    },
  });

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("email_automations")
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      qc.invalidateQueries({ queryKey: ["email_automations"] });
      toast.success(enabled ? "Automation enabled" : "Automation disabled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("email_automations")
        .update({ config } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_automations"] });
      toast.success("Config updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { automations, isLoading, toggleAutomation, updateConfig };
}
