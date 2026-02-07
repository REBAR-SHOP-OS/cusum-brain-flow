import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export interface ClearanceItem {
  id: string;
  cut_plan_id: string;
  bar_code: string;
  cut_length_mm: number;
  mark_number: string | null;
  drawing_ref: string | null;
  asa_shape_code: string | null;
  total_pieces: number;
  bend_completed_pieces: number;
  plan_name: string;
  project_name: string | null;
  // Evidence
  evidence_id: string | null;
  material_photo_url: string | null;
  tag_scan_url: string | null;
  evidence_status: string;
  verified_at: string | null;
}

export function useClearanceData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["clearance-items"],
    enabled: !!user,
    queryFn: async () => {
      // Get all items in clearance phase
      const { data: items, error: itemsError } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name)")
        .eq("phase", "clearance");

      if (itemsError) throw itemsError;
      if (!items?.length) return [];

      // Get matching evidence records
      const itemIds = items.map((i: any) => i.id);
      const { data: evidence } = await supabase
        .from("clearance_evidence")
        .select("*")
        .in("cut_plan_item_id", itemIds);

      const evidenceMap = new Map(
        (evidence || []).map((e: any) => [e.cut_plan_item_id, e])
      );

      return items.map((item: any) => {
        const ev = evidenceMap.get(item.id);
        return {
          id: item.id,
          cut_plan_id: item.cut_plan_id,
          bar_code: item.bar_code,
          cut_length_mm: item.cut_length_mm,
          mark_number: item.mark_number,
          drawing_ref: item.drawing_ref,
          asa_shape_code: item.asa_shape_code,
          total_pieces: item.total_pieces,
          bend_completed_pieces: item.bend_completed_pieces,
          plan_name: item.cut_plans?.name || "",
          project_name: item.cut_plans?.project_name || null,
          evidence_id: ev?.id || null,
          material_photo_url: ev?.material_photo_url || null,
          tag_scan_url: ev?.tag_scan_url || null,
          evidence_status: ev?.status || "pending",
          verified_at: ev?.verified_at || null,
        } as ClearanceItem;
      });
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("clearance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_plan_items" }, () =>
        queryClient.invalidateQueries({ queryKey: ["clearance-items"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "clearance_evidence" }, () =>
        queryClient.invalidateQueries({ queryKey: ["clearance-items"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const clearedCount = (data || []).filter((i) => i.evidence_status === "cleared").length;
  const totalCount = (data || []).length;

  // Group by project
  const byProject = new Map<string, ClearanceItem[]>();
  for (const item of data || []) {
    const key = item.project_name || item.plan_name || "Unassigned";
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(item);
  }

  return {
    items: data ?? [],
    clearedCount,
    totalCount,
    byProject,
    isLoading,
    error,
  };
}
