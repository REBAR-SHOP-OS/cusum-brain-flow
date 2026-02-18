import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

const CURRENT_YEAR = new Date().getFullYear();

export function useTaxPlanning(fiscalYear = CURRENT_YEAR) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const key = ["tax_planning_profiles", companyId, fiscalYear];

  const { data: profile, isLoading } = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning_profiles")
        .select("*")
        .eq("company_id", companyId!)
        .eq("fiscal_year", fiscalYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase
        .from("tax_planning_profiles")
        .upsert({ company_id: companyId!, fiscal_year: fiscalYear, ...values }, { onConflict: "company_id,fiscal_year" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { profile, isLoading, upsert };
}
