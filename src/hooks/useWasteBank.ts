import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface WasteBankPiece {
  id: string;
  company_id: string;
  bar_code: string;
  length_mm: number;
  quantity: number;
  source_job_id: string | null;
  source_batch_id: string | null;
  source_machine_id: string | null;
  status: string;
  location: string | null;
  reserved_by: string | null;
  reserved_at: string | null;
  consumed_at: string | null;
  created_at: string;
}

export function useWasteBank(statusFilter?: string) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`waste-bank-${companyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "waste_bank_pieces",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["waste-bank", companyId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, queryClient]);

  return useQuery({
    queryKey: ["waste-bank", companyId, statusFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("waste_bank_pieces")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WasteBankPiece[];
    },
  });
}
