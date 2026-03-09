import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

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
  project_id: string | null;
  customer_name: string | null;
  project_status: string | null;
}

export interface BarSizeGroup {
  barCode: string;
  bendItems: StationItem[];
  straightItems: StationItem[];
}


export function useStationData(machineId: string | null, machineType?: string, projectId?: string | null) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["station-data", machineId, machineType, companyId, projectId],
    enabled: !!user && !!machineId && !!companyId,
    queryFn: async () => {
      if (machineType === "bender") {
        // Bender: show ALL bend items that are cut_done or bending (regardless of machine assignment)
      let benderQuery = supabase
          .from("cut_plan_items")
          .select("*, cut_plans!inner(id, name, project_name, project_id, company_id, projects(status, customers(name)))")
          .eq("bend_type", "bend")
          .eq("cut_plans.company_id", companyId!)
          .or("phase.eq.cut_done,phase.eq.bending");

        if (projectId) {
          benderQuery = benderQuery.eq("cut_plans.project_id", projectId);
        }

        const { data: items, error: itemsError } = await benderQuery;

        if (itemsError) throw itemsError;

        return (items || [])
          .filter((item: Record<string, unknown>) => {
            const proj = (item.cut_plans as any)?.projects;
            return !proj || proj.status !== 'paused';
          })
          .map((item: Record<string, unknown>) => ({
            ...item,
            bend_completed_pieces: (item.bend_completed_pieces as number) || 0,
            phase: (item.phase as string) || "queued",
            bend_dimensions: item.bend_dimensions as Record<string, number> | null,
            plan_name: (item.cut_plans as Record<string, unknown>)?.name || "",
            project_name: (item.cut_plans as Record<string, unknown>)?.project_name || null,
            project_id: (item.cut_plans as Record<string, unknown>)?.project_id || null,
            customer_name: ((item.cut_plans as any)?.projects?.customers?.name as string) || null,
            project_status: ((item.cut_plans as any)?.projects?.status as string) || null,
          })) as StationItem[];
      }

      // Cutter: route items by bar_code capability, not by plan assignment
      // 1. Fetch machine capabilities
      const { data: caps } = await supabase
        .from("machine_capabilities")
        .select("bar_code")
        .eq("machine_id", machineId!)
        .eq("process", "cut");

      const allowedBarCodes = caps?.length
        ? caps.map((c: any) => c.bar_code)
        : null;

      // Fail-closed: no capabilities defined → show nothing
      if (!allowedBarCodes || allowedBarCodes.length === 0) return [];

      // 2. Fetch ALL cut_plan_items matching this machine's bar_codes
      let cutterQuery = supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name, project_id, company_id, status, projects(status, customers(name)))")
        .in("bar_code", allowedBarCodes)
        .or("phase.eq.queued,phase.eq.cutting")
        .eq("cut_plans.company_id", companyId!)
        .in("cut_plans.status", ["draft", "queued", "running"]);

      if (projectId) {
        cutterQuery = cutterQuery.eq("cut_plans.project_id", projectId);
      }

      const { data: items, error: itemsError } = await cutterQuery;

      if (itemsError) throw itemsError;

      return (items || [])
        .filter((item: Record<string, unknown>) => {
          const proj = (item.cut_plans as any)?.projects;
          return !proj || proj.status !== 'paused';
        })
        .map((item: Record<string, unknown>) => ({
          ...item,
          bend_completed_pieces: (item.bend_completed_pieces as number) || 0,
          phase: (item.phase as string) || "queued",
          bend_dimensions: item.bend_dimensions as Record<string, number> | null,
          plan_name: (item.cut_plans as Record<string, unknown>)?.name || "",
          project_name: (item.cut_plans as Record<string, unknown>)?.project_name || null,
          project_id: (item.cut_plans as Record<string, unknown>)?.project_id || null,
          customer_name: ((item.cut_plans as any)?.projects?.customers?.name as string) || null,
          project_status: ((item.cut_plans as any)?.projects?.status as string) || null,
        }))
        .filter((item: StationItem) => allowedBarCodes.includes(item.bar_code))
        .filter((item: StationItem) => {
          const CUTTER_02_ID = "b0000000-0000-0000-0000-000000000002";
          const BLOCKED_ON_CUTTER_02 = new Set(["10M", "15M"]);
          if (machineId === CUTTER_02_ID && BLOCKED_ON_CUTTER_02.has(item.bar_code)) return false;
          return true;
        }) as StationItem[];
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
        () => queryClient.invalidateQueries({ queryKey: ["station-data", machineId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plans" },
        () => queryClient.invalidateQueries({ queryKey: ["station-data", machineId] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, machineId, machineType, companyId, queryClient]);

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
