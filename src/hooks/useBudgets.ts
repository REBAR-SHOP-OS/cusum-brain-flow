import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface Budget {
  id: string;
  company_id: string;
  name: string;
  fiscal_year: number;
  period_type: string;
  account_category: string | null;
  department: string | null;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

export function useBudgets(fiscalYear?: number) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const year = fiscalYear || new Date().getFullYear();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets", companyId, year],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("company_id", companyId)
        .eq("fiscal_year", year)
        .order("name");
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!companyId,
  });

  const createBudget = useMutation({
    mutationFn: async (input: Partial<Budget> & { name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...input, company_id: companyId!, fiscal_year: year, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateBudget = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Budget> & { id: string }) => {
      const { error } = await supabase.from("budgets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const totalBudgeted = budgets.reduce((sum, b) => {
    return sum + MONTHS.reduce((ms, m) => ms + Number(b[m] || 0), 0);
  }, 0);

  return { budgets, isLoading, createBudget, updateBudget, deleteBudget, totalBudgeted, MONTHS };
}
