import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export interface StationItem {
  id: string;
  cut_plan_id: string;
  bar_code: string;
  qty_bars: number;
  cut_length_mm: number;
  pieces_per_bar: number;
  notes: string | null;
  mark_number: string | null;
  drawing_ref: string | null;
  bend_type: string;
  asa_shape_code: string | null;
  total_pieces: number;
  completed_pieces: number;
  bend_completed_pieces: number;
  needs_fix: boolean;
  bend_dimensions: Record<string, number> | null;
  work_order_id: string | null;
  phase: string;
  // Joined from cut_plans
  plan_name: string;
  project_name: string | null;
}

export interface BarSizeGroup {
  barCode: string;
  bendItems: StationItem[];
  straightItems: StationItem[];
}

export function useStationData(machineId: string | null, machineType?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["station-data", machineId, machineType],
    enabled: !!user && !!machineId,
    queryFn: async () => {
      if (machineType === "bender") {
        // Bender: show ALL bend items that are cut_done or bending (regardless of machine assignment)
        const { data: items, error: itemsError } = await supabase
          .from("cut_plan_items")
          .select("*, cut_plans!inner(id, name, project_name)")
          .eq("bend_type", "bend")
          .or("phase.eq.cut_done,phase.eq.bending");

        if (itemsError) throw itemsError;

        return (items || []).map((item: any) => ({
          ...item,
          bend_completed_pieces: item.bend_completed_pieces || 0,
          phase: item.phase || "queued",
          bend_dimensions: item.bend_dimensions as Record<string, number> | null,
          plan_name: item.cut_plans?.name || "",
          project_name: item.cut_plans?.project_name || null,
        })) as StationItem[];
      }

      // Cutter / default: plans assigned to this machine or unassigned
      const { data: plans, error: plansError } = await supabase
        .from("cut_plans")
        .select("id, name, project_name, machine_id")
        .or(`machine_id.eq.${machineId},machine_id.is.null`)
        .in("status", ["draft", "queued", "running"]);

      if (plansError) throw plansError;
      if (!plans?.length) return [];

      const planIds = plans.map((p) => p.id);
      const planMap = new Map(plans.map((p) => [p.id, p]));

      const { data: items, error: itemsError } = await supabase
        .from("cut_plan_items")
        .select("*")
        .in("cut_plan_id", planIds)
        .or("phase.eq.queued,phase.eq.cutting");

      if (itemsError) throw itemsError;

      return (items || []).map((item: any) => {
        const plan = planMap.get(item.cut_plan_id);
        return {
          ...item,
          bend_completed_pieces: item.bend_completed_pieces || 0,
          phase: item.phase || "queued",
          bend_dimensions: item.bend_dimensions as Record<string, number> | null,
          plan_name: plan?.name || "",
          project_name: plan?.project_name || null,
        } as StationItem;
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || !machineId) return;

    const channel = supabase
      .channel(`station-${machineId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plan_items" },
        () => queryClient.invalidateQueries({ queryKey: ["station-data", machineId, machineType] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plans" },
        () => queryClient.invalidateQueries({ queryKey: ["station-data", machineId, machineType] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, machineId, machineType, queryClient]);

  // Group by bar size
  const groups: BarSizeGroup[] = [];
  if (data) {
    const groupMap = new Map<string, { bend: StationItem[]; straight: StationItem[] }>();
    for (const item of data) {
      if (!groupMap.has(item.bar_code)) {
        groupMap.set(item.bar_code, { bend: [], straight: [] });
      }
      const g = groupMap.get(item.bar_code)!;
      if (item.bend_type === "bend") {
        g.bend.push(item);
      } else {
        g.straight.push(item);
      }
    }
    const sortedKeys = [...groupMap.keys()].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
    for (const key of sortedKeys) {
      const g = groupMap.get(key)!;
      groups.push({ barCode: key, bendItems: g.bend, straightItems: g.straight });
    }
  }

  return {
    items: data ?? [],
    groups,
    isLoading,
    error,
  };
}
