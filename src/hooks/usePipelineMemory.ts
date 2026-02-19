import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks which memory records exist for a given lead.
 * Used by transition gates to determine if a modal is needed.
 */
export function usePipelineMemory(leadId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-memory-check", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      if (!leadId) return { hasQualification: false, hasPricing: false, hasLoss: false, hasOutcome: false };

      const [qual, quote, loss, outcome] = await Promise.all([
        supabase.from("lead_qualification_memory").select("id").eq("lead_id", leadId).maybeSingle(),
        supabase.from("lead_quote_memory").select("id").eq("lead_id", leadId).eq("is_current", true).maybeSingle(),
        supabase.from("lead_loss_memory").select("id").eq("lead_id", leadId).maybeSingle(),
        supabase.from("lead_outcome_memory").select("id").eq("lead_id", leadId).maybeSingle(),
      ]);

      return {
        hasQualification: !!qual.data,
        hasPricing: !!quote.data,
        hasLoss: !!loss.data,
        hasOutcome: !!outcome.data,
      };
    },
    staleTime: 30_000,
  });

  return {
    memory: data ?? { hasQualification: false, hasPricing: false, hasLoss: false, hasOutcome: false },
    isLoading,
  };
}
