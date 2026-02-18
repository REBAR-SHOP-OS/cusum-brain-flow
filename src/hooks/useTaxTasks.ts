import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

const CURRENT_YEAR = new Date().getFullYear();

const VICKY_SEEDS = [
  { title: "Review owner compensation", description: "Dividend-first strategy documented", category: "owner-pay" as const },
  { title: "Review expense categories", description: "Identify underclaimed deductions", category: "expenses" as const },
  { title: "Review HSA setup", description: "Implement Health Spending Account immediately", category: "hsa" as const },
  { title: "Review CCA schedule", description: "Optimize depreciation timing", category: "cca" as const },
  { title: "Review GST/HST ITCs", description: "Confirm nothing missed", category: "gst-hst" as const },
];

export function useTaxTasks(fiscalYear = CURRENT_YEAR) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const key = ["tax_planning_tasks", companyId, fiscalYear];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning_tasks")
        .select("*")
        .eq("company_id", companyId!)
        .eq("fiscal_year", fiscalYear)
        .order("created_at");
      if (error) throw error;
      // Auto-seed if empty
      if (!data || data.length === 0) {
        const seeds = VICKY_SEEDS.map(s => ({ ...s, company_id: companyId!, fiscal_year: fiscalYear, status: "todo" as const }));
        const { data: seeded, error: seedErr } = await supabase.from("tax_planning_tasks").insert(seeds).select();
        if (seedErr) throw seedErr;
        return seeded || [];
      }
      return data;
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const updates: Record<string, unknown> = { ...values, updated_at: new Date().toISOString() };
      if (values.status === "done") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("tax_planning_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addTask = useMutation({
    mutationFn: async (values: { title: string; description?: string; category: string }) => {
      const { error } = await supabase.from("tax_planning_tasks").insert({ ...values, company_id: companyId!, fiscal_year: fiscalYear });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { tasks, isLoading, updateTask, addTask };
}
