import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

const CURRENT_YEAR = new Date().getFullYear();

export function useTaxDeductions(fiscalYear = CURRENT_YEAR) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const key = ["tax_deduction_tracker", companyId, fiscalYear];

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_deduction_tracker")
        .select("*")
        .eq("company_id", companyId!)
        .eq("fiscal_year", fiscalYear)
        .order("category");
      if (error) throw error;
      return data || [];
    },
  });

  const upsertDeduction = useMutation({
    mutationFn: async (values: { id?: string; category: string; description: string; estimated_amount: number; claimed_amount: number; is_claimed: boolean }) => {
      if (values.id) {
        const { error } = await supabase.from("tax_deduction_tracker").update({ ...values, updated_at: new Date().toISOString() }).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tax_deduction_tracker").insert({ ...values, company_id: companyId!, fiscal_year: fiscalYear });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteDeduction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_deduction_tracker").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { deductions, isLoading, upsertDeduction, deleteDeduction };
}
