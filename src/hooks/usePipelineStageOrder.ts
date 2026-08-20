import { useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { PIPELINE_STAGES } from "@/pages/Pipeline";

const COMPANY_ID = "a0000000-0000-0000-0000-000000000001";
const DEBOUNCE_MS = 500;

export function usePipelineStageOrder() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: savedOrder } = useQuery({
    queryKey: ["pipeline_stage_order"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stage_order" as any)
        .select("stage_order")
        .eq("company_id", COMPANY_ID)
        .maybeSingle() as { data: { stage_order: string[] } | null; error: any };
      if (error) {
        console.warn("pipeline_stage_order fetch error:", error.message);
        return [];
      }
      return data?.stage_order || [];
    },
  });

  // Merge saved order with hardcoded stages (handles new stages not yet in DB)
  const orderedStages = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return PIPELINE_STAGES;

    const stageMap = new Map(PIPELINE_STAGES.map((s) => [s.id, s]));
    const ordered: typeof PIPELINE_STAGES = [];

    // Add stages in saved order
    for (const id of savedOrder) {
      const stage = stageMap.get(id);
      if (stage) {
        ordered.push(stage);
        stageMap.delete(id);
      }
    }

    // Append any new stages not in saved order
    for (const stage of stageMap.values()) {
      ordered.push(stage);
    }

    return ordered;
  }, [savedOrder]);

  const saveOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      const { error } = await (supabase
        .from("pipeline_stage_order" as any) as any)
        .upsert(
          {
            company_id: COMPANY_ID,
            stage_order: newOrder,
            updated_at: new Date().toISOString(),
            updated_by: user!.id,
          },
          { onConflict: "company_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_stage_order"] });
    },
  });

  // Debounced save to prevent rapid-fire DB writes during drag reorder
  const saveOrder = useCallback(
    (newOrder: string[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveOrderMutation.mutate(newOrder);
      }, DEBOUNCE_MS);
    },
    [saveOrderMutation]
  );

  return {
    orderedStages,
    saveOrder,
    canReorder: isAdmin,
  };
}
