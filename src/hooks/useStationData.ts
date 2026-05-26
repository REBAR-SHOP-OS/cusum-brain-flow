import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { isSeededMachineId } from "@/components/shopfloor/seededMachines";

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
  source_total_length_text: string | null;
  unit_system: string | null;
  work_order_id: string | null;
  phase: string;
  plan_name: string;
  project_name: string | null;
  project_id: string | null;
  customer_name: string | null;
  project_status: string | null;
  optimization_mode: string | null;
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

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["station-data", machineId, machineType, companyId, projectId],
    enabled: !!user && !!machineId && !!companyId,
    queryFn: async () => {
      if (isSeededMachineId(machineId)) {
        return [] as StationItem[];
      }

      if (machineType === "bender") {
        let benderQuery = supabase
          .from("cut_plan_items")
          .select("*, cut_plans!inner(id, name, project_name, project_id, company_id, optimization_mode, projects(status, customers(name)))")
          .eq("bend_type", "bend")
          .eq("cut_plans.company_id", companyId!)
          .or("phase.eq.cut_done,phase.eq.bending");

        if (projectId) {
          benderQuery = benderQuery.eq("cut_plans.project_id", projectId);
        }

        const { data: items, error: itemsError } = await benderQuery.order("id", { ascending: true });
        if (itemsError) throw itemsError;

        return (items || [])
          .filter((item: Record<string, unknown>) => {
            const proj = (item.cut_plans as any)?.projects;
            return !proj || proj.status !== "paused";
          })
          .map((item: Record<string, unknown>) => ({
            ...item,
            bend_completed_pieces: (item.bend_completed_pieces as number) || 0,
            phase: (item.phase as string) || "queued",
            bend_dimensions: item.bend_dimensions as Record<string, number> | null,
            source_total_length_text: (item as any).source_total_length_text || null,
            unit_system: (item as any).unit_system ?? null,
            plan_name: (item.cut_plans as Record<string, unknown>)?.name || "",
            project_name: (item.cut_plans as Record<string, unknown>)?.project_name || null,
            project_id: (item.cut_plans as Record<string, unknown>)?.project_id || null,
            customer_name: ((item.cut_plans as any)?.projects?.customers?.name as string) || null,
            project_status: ((item.cut_plans as any)?.projects?.status as string) || null,
            optimization_mode: (item.cut_plans as Record<string, unknown>)?.optimization_mode as string || null,
          })) as StationItem[];
      }

      const { data: caps } = await supabase
        .from("machine_capabilities")
        .select("bar_code")
        .eq("machine_id", machineId!)
        .eq("process", "cut");

      const allowedBarCodes = caps?.length ? caps.map((cap: any) => cap.bar_code) : null;
      if (!allowedBarCodes || allowedBarCodes.length === 0) return [];

      let cutterQuery = supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name, project_id, company_id, status, optimization_mode, projects(status, customers(name)))")
        .in("bar_code", allowedBarCodes)
        .or("phase.eq.queued,phase.eq.cutting")
        .eq("cut_plans.company_id", companyId!)
        .in("cut_plans.status", ["draft", "queued", "running"]);

      if (projectId) {
        cutterQuery = cutterQuery.eq("cut_plans.project_id", projectId);
      }

      const { data: items, error: itemsError } = await cutterQuery.order("id", { ascending: true });
      if (itemsError) throw itemsError;

      return (items || [])
        .filter((item: Record<string, unknown>) => {
          const proj = (item.cut_plans as any)?.projects;
          return !proj || proj.status !== "paused";
        })
        .map((item: Record<string, unknown>) => ({
          ...item,
          bend_completed_pieces: (item.bend_completed_pieces as number) || 0,
          phase: (item.phase as string) || "queued",
          bend_dimensions: item.bend_dimensions as Record<string, number> | null,
          source_total_length_text: (item as any).source_total_length_text || null,
          unit_system: (item as any).unit_system ?? null,
          plan_name: (item.cut_plans as Record<string, unknown>)?.name || "",
          project_name: (item.cut_plans as Record<string, unknown>)?.project_name || null,
          project_id: (item.cut_plans as Record<string, unknown>)?.project_id || null,
          customer_name: ((item.cut_plans as any)?.projects?.customers?.name as string) || null,
          project_status: ((item.cut_plans as any)?.projects?.status as string) || null,
          optimization_mode: (item.cut_plans as Record<string, unknown>)?.optimization_mode as string || null,
        }))
        .filter((item: StationItem) => allowedBarCodes.includes(item.bar_code))
        .filter((item: StationItem) => {
          const CUTTER_01_ID = "e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3";
          const CUTTER_02_ID = "b0000000-0000-0000-0000-000000000002";
          const ALLOWED_ON_CUTTER_01 = new Set(["10M", "15M"]);
          const BLOCKED_ON_CUTTER_02 = new Set(["10M", "15M"]);
          if (machineId === CUTTER_01_ID && !ALLOWED_ON_CUTTER_01.has(item.bar_code)) return false;
          if (machineId === CUTTER_02_ID && BLOCKED_ON_CUTTER_02.has(item.bar_code)) return false;
          return true;
        }) as StationItem[];
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!user || !machineId || isSeededMachineId(machineId)) return;

    const debouncedInvalidate = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["station-data", machineId] });
      }, 500);
    };

    const channel = supabase
      .channel(`station-${machineId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plan_items" },
        debouncedInvalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plans" },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, machineId, machineType, companyId, queryClient]);

  const groups: BarSizeGroup[] = [];
  if (data) {
    const groupMap = new Map<string, { bend: StationItem[]; straight: StationItem[] }>();
    for (const item of data) {
      if (!groupMap.has(item.bar_code)) {
        groupMap.set(item.bar_code, { bend: [], straight: [] });
      }
      const group = groupMap.get(item.bar_code)!;
      if (item.bend_type === "bend") {
        group.bend.push(item);
      } else {
        group.straight.push(item);
      }
    }
    const sortedKeys = [...groupMap.keys()].sort((left, right) => {
      const numLeft = parseInt(left.replace(/\D/g, "")) || 0;
      const numRight = parseInt(right.replace(/\D/g, "")) || 0;
      return numLeft - numRight;
    });
    for (const key of sortedKeys) {
      const group = groupMap.get(key)!;
      groups.push({
        barCode: key,
        bendItems: group.bend.sort((left, right) => (right.cut_length_mm || 0) - (left.cut_length_mm || 0)),
        straightItems: group.straight.sort((left, right) => (right.cut_length_mm || 0) - (left.cut_length_mm || 0)),
      });
    }
  }

  return {
    items: data ?? [],
    groups,
    isLoading,
    isFetching,
    error,
  };
}
