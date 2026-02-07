import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["completed-bundles"],
    enabled: !!user,
    queryFn: async () => {
      const { data: items, error: err } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name)")
        .eq("phase", "complete");

      if (err) throw err;
      if (!items?.length) return [];

      // Group by project
      const byProject = new Map<string, { planName: string; cutPlanId: string; items: any[] }>();
      for (const item of items as any[]) {
        const key = item.cut_plans?.project_name || item.cut_plans?.name || "Unassigned";
        if (!byProject.has(key)) {
          byProject.set(key, {
            planName: item.cut_plans?.name || "",
            cutPlanId: item.cut_plan_id,
            items: [],
          });
        }
        byProject.get(key)!.items.push({
          id: item.id,
          mark_number: item.mark_number,
          drawing_ref: item.drawing_ref,
          bar_code: item.bar_code,
          cut_length_mm: item.cut_length_mm,
          total_pieces: item.total_pieces,
          asa_shape_code: item.asa_shape_code,
        });
      }

      const bundles: CompletedBundle[] = [];
      for (const [projectName, data] of byProject) {
        bundles.push({
          projectName,
          planName: data.planName,
          cutPlanId: data.cutPlanId,
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
        () => queryClient.invalidateQueries({ queryKey: ["completed-bundles"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return { bundles: data ?? [], isLoading, error };
}
