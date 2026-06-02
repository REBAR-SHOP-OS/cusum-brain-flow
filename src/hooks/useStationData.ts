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
  source_dims?: Record<string, string> | null;
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
            source_dims: ((item as any).source_dims_json as Record<string, string> | null) ?? null,
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

      // Station membership = machine_queue_items.machine_id (source of truth).
      // machine_capabilities is only used to answer "can this machine process this bar?".
      const { data: queueRows, error: queueErr } = await supabase
        .from("machine_queue_items")
        .select("id, task_id, status, machine_id")
        .eq("machine_id", machineId!)
        .eq("company_id", companyId!)
        .in("status", ["queued", "running"]);
      if (queueErr) throw queueErr;

      console.debug("[useStationData] route machineId=", machineId,
        "machine_queue_items count=", queueRows?.length ?? 0);

      const taskIds = Array.from(new Set((queueRows || []).map((r: any) => r.task_id).filter(Boolean)));
      if (taskIds.length === 0) {
        console.debug("[useStationData] final rendered item count= 0 (no queue rows)");
        return [] as StationItem[];
      }

      const { data: tasks, error: tasksErr } = await supabase
        .from("production_tasks")
        .select("id, cut_plan_item_id, status, bar_code")
        .in("id", taskIds);
      if (tasksErr) throw tasksErr;

      console.debug("[useStationData] joined production_tasks count=", tasks?.length ?? 0);

      const cpiIds = Array.from(new Set((tasks || []).map((t: any) => t.cut_plan_item_id).filter(Boolean)));
      if (cpiIds.length === 0) {
        console.debug("[useStationData] final rendered item count= 0 (no cut_plan_item_id on tasks)");
        return [] as StationItem[];
      }

      // Advisory capability lookup — used only for debug logging, NOT to gate station membership.
      const { data: caps } = await supabase
        .from("machine_capabilities")
        .select("bar_code")
        .eq("machine_id", machineId!)
        .eq("process", "cut");
      const capableBarCodes = new Set((caps || []).map((c: any) => c.bar_code));

      let cutterQuery = supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, project_name, project_id, company_id, status, optimization_mode, projects(status, customers(name)))")
        .in("id", cpiIds)
        .eq("cut_plans.company_id", companyId!)
        .in("cut_plans.status", ["draft", "queued", "running", "in_production"]);

      if (projectId) {
        cutterQuery = cutterQuery.eq("cut_plans.project_id", projectId);
      }

      const { data: items, error: itemsError } = await cutterQuery.order("id", { ascending: true });
      if (itemsError) throw itemsError;

      console.debug("[useStationData] joined cut_plan_items count=", items?.length ?? 0);

      // Exclude items that already have clearance evidence (tag/material captured or cleared).
      const { data: evidenceRows } = await supabase
        .from("clearance_evidence")
        .select("cut_plan_item_id, status, verification_state, tag_scan_url, material_photo_url, evidence_valid")
        .in("cut_plan_item_id", cpiIds);
      const clearedCpiIds = new Set<string>();
      for (const ev of (evidenceRows || []) as any[]) {
        const valid = ev.evidence_valid !== false; // null/true count as valid
        if (!valid) continue;
        const hasPhoto = !!ev.tag_scan_url || !!ev.material_photo_url;
        const clearedStatus = ev.status === "cleared";
        const advancedState = ["tag_scanned", "product_captured", "complete"].includes(ev.verification_state);
        if (hasPhoto || clearedStatus || advancedState) {
          clearedCpiIds.add(ev.cut_plan_item_id);
        }
      }

      // Cutter station: only show items still needing cutter work.
      const CUTTER_ALLOWED_PHASES = new Set(["queued", "cutting"]);
      const mapped = (items || [])
        .filter((item: Record<string, unknown>) => {
          const proj = (item.cut_plans as any)?.projects;
          const keep = !proj || proj.status !== "paused";
          if (!keep) console.debug("[useStationData] excluded cpi", (item as any).id, "reason=project_paused");
          return keep;
        })
        .filter((item: any) => {
          const phase = (item.phase as string) || "queued";
          if (!CUTTER_ALLOWED_PHASES.has(phase)) {
            console.debug("[useStationData] excluded cpi", item.id, "reason=phase_beyond_cutter", phase);
            return false;
          }
          const total = Number(item.total_pieces) || (Number(item.qty_bars) * Number(item.pieces_per_bar)) || 0;
          const done = Number(item.completed_pieces) || 0;
          if (total > 0 && done >= total) {
            console.debug("[useStationData] excluded cpi", item.id, "reason=fully_completed", done, "/", total);
            return false;
          }
          if (clearedCpiIds.has(item.id)) {
            console.debug("[useStationData] excluded cpi", item.id, "reason=clearance_evidence_exists");
            return false;
          }
          return true;
        })
        .map((item: Record<string, unknown>) => ({
          ...item,
          bend_completed_pieces: (item.bend_completed_pieces as number) || 0,
          phase: (item.phase as string) || "queued",
          bend_dimensions: item.bend_dimensions as Record<string, number> | null,
          source_dims: ((item as any).source_dims_json as Record<string, string> | null) ?? null,
          source_total_length_text: (item as any).source_total_length_text || null,
          unit_system: (item as any).unit_system ?? null,
          plan_name: (item.cut_plans as Record<string, unknown>)?.name || "",
          project_name: (item.cut_plans as Record<string, unknown>)?.project_name || null,
          project_id: (item.cut_plans as Record<string, unknown>)?.project_id || null,
          customer_name: ((item.cut_plans as any)?.projects?.customers?.name as string) || null,
          project_status: ((item.cut_plans as any)?.projects?.status as string) || null,
          optimization_mode: (item.cut_plans as Record<string, unknown>)?.optimization_mode as string || null,
        }))
        // De-dup safety in case the same cut_plan_item is referenced by multiple queue rows.
        .filter((item: any, idx: number, arr: any[]) => arr.findIndex((x) => x.id === item.id) === idx);

      for (const it of mapped as any[]) {
        if (capableBarCodes.size > 0 && !capableBarCodes.has(it.bar_code)) {
          console.debug("[useStationData] note: queued item", it.id, "bar_code", it.bar_code,
            "not listed in machine_capabilities for", machineId, "(membership respected via queue row)");
        }
      }

      console.debug("[useStationData] final rendered item count=", mapped.length);
      return mapped as StationItem[];
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
      .channel(`station-${machineId}-${crypto.randomUUID()}`)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machine_queue_items" },
        debouncedInvalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_tasks" },
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
