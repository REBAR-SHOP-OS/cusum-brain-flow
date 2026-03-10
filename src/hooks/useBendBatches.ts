import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface BendBatch {
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

export function useBendBatches(statusFilter?: string) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`bend-batches-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bend_batches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["bend-batches", companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, queryClient]);

  return useQuery({
    queryKey: ["bend-batches", companyId, statusFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("bend_batches" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BendBatch[];
    },
  });
}
