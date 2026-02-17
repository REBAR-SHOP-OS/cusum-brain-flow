import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface CompletedBundle {
  projectName: string;
  planName: string;
  cutPlanId: string;
  items: CompletedBundleItem[];
  totalPieces: number;
}

export interface CompletedBundleItem {
  id: string;
  mark_number: string | null;
  drawing_ref: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  asa_shape_code: string | null;
}

export function useCompletedBundles() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["completed-bundles", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data: items, error: err } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name, company_id)")
        .eq("phase", "complete")
        .eq("cut_plans.company_id", companyId!);

      if (err) throw err;
      if (!items?.length) return [];

      // Group by cutPlanId to prevent merge bugs when multiple plans share a project name
      const byPlan = new Map<string, { projectName: string; planName: string; items: CompletedBundleItem[] }>();
      for (const item of items as Record<string, unknown>[]) {
        const cutPlans = item.cut_plans as Record<string, unknown> | undefined;
        const key = item.cut_plan_id as string;
        if (!byPlan.has(key)) {
          byPlan.set(key, {
            projectName: (cutPlans?.project_name as string) || (cutPlans?.name as string) || "Unassigned",
            planName: (cutPlans?.name as string) || "",
            items: [],
          });
        }
        byPlan.get(key)!.items.push({
          id: item.id as string,
          mark_number: item.mark_number as string | null,
          drawing_ref: item.drawing_ref as string | null,
          bar_code: item.bar_code as string,
          cut_length_mm: item.cut_length_mm as number,
          total_pieces: item.total_pieces as number,
          asa_shape_code: item.asa_shape_code as string | null,
        });
      }

      const bundles: CompletedBundle[] = [];
      for (const [cutPlanId, data] of byPlan) {
        bundles.push({
          projectName: data.projectName,
          planName: data.planName,
          cutPlanId,
          items: data.items,
          totalPieces: data.items.reduce((sum, i) => sum + i.total_pieces, 0),
        });
      }
      return bundles;
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("completed-bundles-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_plan_items" },
        () => queryClient.invalidateQueries({ queryKey: ["completed-bundles", companyId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, companyId, queryClient]);

  return { bundles: data ?? [], isLoading, error };
}
