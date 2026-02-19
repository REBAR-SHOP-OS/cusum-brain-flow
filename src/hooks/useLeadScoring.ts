import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export const LEAD_FIELDS = [
  { value: "stage", label: "Stage" },
  { value: "priority", label: "Priority" },
  { value: "probability", label: "Probability %" },
  { value: "expected_value", label: "Expected Value" },
  { value: "source", label: "Source" },
  { value: "customer_id", label: "Has Customer" },
] as const;

export const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
] as const;

export function useLeadScoring() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const rules = useQuery({
    queryKey: ["lead_scoring_rules", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_scoring_rules")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const leads = useQuery({
    queryKey: ["leads_for_scoring", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, title, stage, priority, probability, expected_value, source, customer_id, computed_score")
        .eq("company_id", companyId!)
        .order("computed_score", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createRule = useMutation({
    mutationFn: async (rule: { name: string; field_name: string; operator: string; field_value: string; score_points: number }) => {
      const { error } = await supabase.from("lead_scoring_rules").insert({ ...rule, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead_scoring_rules"] }); toast.success("Rule created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [k: string]: any }) => {
      const { error } = await supabase.from("lead_scoring_rules").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead_scoring_rules"] }); toast.success("Rule updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_scoring_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead_scoring_rules"] }); toast.success("Rule deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // Client-side scoring engine
  const computeScore = (lead: any, rulesList: any[]) => {
    let score = 0;
    for (const rule of rulesList) {
      if (!rule.enabled) continue;
      const val = String(lead[rule.field_name] ?? "");
      let match = false;
      switch (rule.operator) {
        case "equals": match = val === rule.field_value; break;
        case "not_equals": match = val !== rule.field_value; break;
        case "contains": match = val.toLowerCase().includes(rule.field_value.toLowerCase()); break;
        case "greater_than": match = parseFloat(val) > parseFloat(rule.field_value); break;
        case "less_than": match = parseFloat(val) < parseFloat(rule.field_value); break;
        case "is_set": match = !!val && val !== "null" && val !== "undefined"; break;
        case "is_not_set": match = !val || val === "null" || val === "undefined"; break;
      }
      if (match) score += rule.score_points;
    }
    return score;
  };

  const recalculateAll = useMutation({
    mutationFn: async () => {
      const rulesList = rules.data ?? [];
      const leadsList = leads.data ?? [];
      if (!rulesList.length || !leadsList.length) return;

      for (const lead of leadsList) {
        const score = computeScore(lead, rulesList);
        if (score !== lead.computed_score) {
          await supabase.from("leads").update({ computed_score: score, score_updated_at: new Date().toISOString() }).eq("id", lead.id);

          // Record score history
          if (companyId) {
            const factors: Record<string, number> = {};
            for (const rule of rulesList) {
              if (!rule.enabled) continue;
              const val = String(lead[rule.field_name as keyof typeof lead] ?? "");
              let match = false;
              switch (rule.operator) {
                case "equals": match = val === rule.field_value; break;
                case "not_equals": match = val !== rule.field_value; break;
                case "contains": match = val.toLowerCase().includes(rule.field_value.toLowerCase()); break;
                case "greater_than": match = parseFloat(val) > parseFloat(rule.field_value); break;
                case "less_than": match = parseFloat(val) < parseFloat(rule.field_value); break;
                case "is_set": match = !!val && val !== "null" && val !== "undefined"; break;
                case "is_not_set": match = !val || val === "null" || val === "undefined"; break;
              }
              if (match) factors[rule.name] = rule.score_points;
            }

            await supabase.from("lead_score_history").insert({
              lead_id: lead.id,
              company_id: companyId,
              score,
              win_probability: (lead as any).win_prob_score ?? null,
              priority_score: (lead as any).priority_score ?? null,
              score_factors: factors,
            });
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads_for_scoring"] }); toast.success("Scores recalculated"); },
    onError: (e) => toast.error(e.message),
  });

  return {
    rules: rules.data ?? [],
    leads: leads.data ?? [],
    isLoading: rules.isLoading || leads.isLoading,
    createRule,
    updateRule,
    deleteRule,
    recalculateAll,
    computeScore,
  };
}
