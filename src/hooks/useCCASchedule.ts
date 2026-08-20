import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

const CURRENT_YEAR = new Date().getFullYear();

export function useCCASchedule(fiscalYear = CURRENT_YEAR) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const key = ["cca_schedule_items", companyId, fiscalYear];

  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cca_schedule_items")
        .select("*")
        .eq("company_id", companyId!)
        .eq("fiscal_year", fiscalYear)
        .order("cca_class");
      if (error) throw error;
      return data || [];
    },
  });

  const upsertItem = useMutation({
    mutationFn: async (values: Record<string, unknown> & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase.from("cca_schedule_items").update({ ...values, updated_at: new Date().toISOString() }).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cca_schedule_items").insert({ ...values, company_id: companyId!, fiscal_year: fiscalYear });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cca_schedule_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { items, isLoading, upsertItem, deleteItem };
}
