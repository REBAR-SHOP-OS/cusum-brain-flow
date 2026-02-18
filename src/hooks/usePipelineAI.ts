import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";

export interface PipelineAIAction {
  id: string;
  lead_id: string;
  action_type: string;
  status: string;
  priority: string;
  ai_reasoning: string | null;
  suggested_data: Record<string, unknown>;
  company_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  leads?: { title: string; stage: string; customers: { name: string; company_name: string | null } | null } | null;
}

const SCAN_COOLDOWN_KEY = "pipeline_ai_last_scan";
const SCAN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function usePipelineAI(enabled: boolean) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Fetch pending AI actions
  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["pipeline-ai-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_ai_actions")
        .select("*, leads(title, stage, customers(name, company_name))")
        .in("status", ["pending"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PipelineAIAction[];
    },
    enabled,
    refetchInterval: enabled ? 60000 : false,
  });

  // Approve action
  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("pipeline_ai_actions")
        .update({ status: "approved" })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
    },
    onError: (err) => {
      toast({ title: "Error approving action", description: err.message, variant: "destructive" });
    },
  });

  // Dismiss action
  const dismissMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("pipeline_ai_actions")
        .update({ status: "dismissed" })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
    },
    onError: (err) => {
      toast({ title: "Error dismissing action", description: err.message, variant: "destructive" });
    },
  });

  // Execute an approved action
  const executeMutation = useMutation({
    mutationFn: async ({ actionId, onExecute }: { actionId: string; onExecute: () => Promise<void> }) => {
      await onExecute();
      const { error } = await supabase
        .from("pipeline_ai_actions")
        .update({ status: "executed" })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "AI action executed" });
    },
    onError: (err) => {
      toast({ title: "Error executing action", description: err.message, variant: "destructive" });
    },
  });

  // Check scan cooldown
  const canScan = useCallback(() => {
    const last = localStorage.getItem(SCAN_COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last) > SCAN_COOLDOWN_MS;
  }, []);

  // Run AI scan
  const runScan = useCallback(async (pipelineStats: Record<string, unknown>) => {
    if (!canScan()) {
      toast({ title: "Scan rate-limited", description: "Please wait 30 minutes between scans." });
      return;
    }
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: { action: "autopilot_scan", pipelineStats },
      });
      if (error) throw error;

      const suggestions = data?.suggestions || [];
      if (suggestions.length === 0) {
        toast({ title: "No new suggestions", description: "Pipeline looks good!" });
      } else {
        // Get user's company_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
          .single();

        const { data: userData } = await supabase.auth.getUser();

        // Insert suggestions into DB
        const rows = suggestions.map((s: any) => ({
          lead_id: s.lead_id,
          action_type: s.action_type,
          priority: s.priority || "medium",
          ai_reasoning: s.reasoning,
          suggested_data: s.suggested_data || {},
          company_id: profile?.company_id || "",
          created_by: userData.user?.id || null,
        }));

        const { error: insertError } = await supabase
          .from("pipeline_ai_actions")
          .insert(rows);
        if (insertError) throw insertError;

        localStorage.setItem(SCAN_COOLDOWN_KEY, Date.now().toString());
        queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
        toast({ title: `${suggestions.length} AI suggestions queued`, description: "Review them in the AI panel." });
      }
    } catch (err) {
      console.error("AI scan error:", err);
      toast({ title: "AI scan failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  }, [canScan, toast, queryClient]);

  // Bulk actions
  const approveAll = useCallback(async () => {
    const pendingIds = actions.filter(a => a.status === "pending").map(a => a.id);
    if (pendingIds.length === 0) return;
    const { error } = await supabase
      .from("pipeline_ai_actions")
      .update({ status: "approved" })
      .in("id", pendingIds);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
      toast({ title: `${pendingIds.length} actions approved` });
    }
  }, [actions, toast, queryClient]);

  const dismissAll = useCallback(async () => {
    const pendingIds = actions.filter(a => a.status === "pending").map(a => a.id);
    if (pendingIds.length === 0) return;
    const { error } = await supabase
      .from("pipeline_ai_actions")
      .update({ status: "dismissed" })
      .in("id", pendingIds);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["pipeline-ai-actions"] });
      toast({ title: `${pendingIds.length} actions dismissed` });
    }
  }, [actions, toast, queryClient]);

  return {
    actions,
    isLoading,
    isScanning,
    canScan,
    runScan,
    approveAction: approveMutation.mutate,
    dismissAction: dismissMutation.mutate,
    executeAction: executeMutation.mutate,
    approveAll,
    dismissAll,
    pendingCount: actions.filter(a => a.status === "pending").length,
  };
}
