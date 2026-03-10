import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface Bundle {
  id: string;
  company_id: string;
  source_job_id: string | null;
  source_bend_batch_id: string | null;
  source_cut_batch_id: string | null;
  size: string | null;
  shape: string | null;
  quantity: number;
  status: string;
  bundle_code: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function useBundles(statusFilter?: string) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`bundles-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bundles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["bundles", companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, queryClient]);

  return useQuery({
    queryKey: ["bundles", companyId, statusFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("bundles" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Bundle[];
    },
  });
}
