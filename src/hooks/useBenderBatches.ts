import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface BenderBatchItem {
  id: string;
  company_id: string;
  source_cut_batch_id: string | null;
  source_job_id: string | null;
  machine_id: string | null;
  bend_pattern: string | null;
  shape: string | null;
  size: string | null;
  planned_qty: number;
  actual_qty: number | null;
  variance: number | null;
  status: string;
  assigned_operator: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Fetches bend_batches for a specific machine, filtered to actionable statuses.
 * Realtime-enabled.
 */
export function useBenderBatches(machineId: string | null) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId || !machineId) return;
    const channel = supabase
      .channel(`bender-batches-${machineId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bend_batches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["bender-batches", machineId, companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [machineId, companyId, queryClient]);

  return useQuery({
    queryKey: ["bender-batches", machineId, companyId],
    enabled: !!machineId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bend_batches" as any)
        .select("*")
        .eq("company_id", companyId!)
        .eq("machine_id", machineId!)
        .in("status", ["queued", "bending", "paused"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BenderBatchItem[];
    },
  });
}
