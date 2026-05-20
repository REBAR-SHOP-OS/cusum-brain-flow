import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface ClearanceItem {
  id: string;
  cut_plan_id: string;
  project_id: string | null;
  bar_code: string;
  cut_length_mm: number;
  unit_system: string | null;
  source_total_length_text: string | null;
  mark_number: string | null;
  drawing_ref: string | null;
  asa_shape_code: string | null;
  total_pieces: number;
  bend_completed_pieces: number;
  plan_name: string;
  project_name: string | null;
  customer_name: string | null;
  barlist_name: string | null;
  barlist_revision_no: number | null;
  barlist_status: string | null;
  cut_plan_status: string | null;
  evidence_id: string | null;
  material_photo_url: string | null;
  tag_scan_url: string | null;
  evidence_status: string;
  verified_at: string | null;
  verified_by_name: string | null;
  created_at: string | null;
}

export function useClearanceData() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["clearance-items", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data: items, error: itemsError } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(id, name, status, project_name, project_id, company_id, barlist_id, projects(id, name, customer_id, customers(name)), barlists(name, revision_no, status))")
        .eq("phase", "clearance")
        .eq("cut_plans.company_id", companyId!);

      if (itemsError) throw itemsError;
      if (!items?.length) return [];

      const itemIds = items.map((i: any) => i.id);
      const { data: evidence } = await supabase
        .from("clearance_evidence")
        .select("*")
        .in("cut_plan_item_id", itemIds);

      const evidenceMap = new Map(
        (evidence || []).map((e: any) => [e.cut_plan_item_id, e])
      );

      // Fetch verifier names
      const verifierIds = [...new Set(
        (evidence || []).map((e: any) => e.verified_by).filter(Boolean)
      )] as string[];

      const profileMap = new Map<string, string>();
      if (verifierIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", verifierIds);
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p.full_name));
      }

      // Stable sort so grouping/Map insertion order is deterministic across refetches.
      // Without this, Postgres may return rows in different order each tick, causing
      // the project cards (e.g. "Walden Homes") to visibly reshuffle / flicker.
      const sortedItems = [...items].sort((a: any, b: any) => {
        const ka = `${a.cut_plan_id || ""}|${a.id}`;
        const kb = `${b.cut_plan_id || ""}|${b.id}`;
        return ka.localeCompare(kb);
      });

      return sortedItems.map((item: any) => {
        const ev = evidenceMap.get(item.id);
        return {
          id: item.id,
          cut_plan_id: item.cut_plan_id,
          project_id: item.cut_plans?.project_id || null,
          bar_code: item.bar_code,
          cut_length_mm: item.cut_length_mm,
          unit_system: item.unit_system ?? null,
          source_total_length_text: item.source_total_length_text ?? null,
          mark_number: item.mark_number,
          drawing_ref: item.drawing_ref,
          asa_shape_code: item.asa_shape_code,
          total_pieces: item.total_pieces,
          bend_completed_pieces: item.bend_completed_pieces,
          plan_name: item.cut_plans?.name || "",
          project_name: item.cut_plans?.projects?.name || item.cut_plans?.project_name || null,
          customer_name: item.cut_plans?.projects?.customers?.name || null,
          barlist_name: item.cut_plans?.barlists?.name || item.cut_plans?.name || null,
          barlist_revision_no: typeof item.cut_plans?.barlists?.revision_no === "number"
            ? item.cut_plans.barlists.revision_no
            : null,
          barlist_status: item.cut_plans?.barlists?.status || null,
          cut_plan_status: item.cut_plans?.status || null,
          evidence_id: ev?.id || null,
          material_photo_url: ev?.material_photo_url || null,
          tag_scan_url: ev?.tag_scan_url || null,
          evidence_status: ev?.status || "pending",
          verified_at: ev?.verified_at || null,
          verified_by_name: ev?.verified_by ? profileMap.get(ev.verified_by) || null : null,
        } as ClearanceItem;
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`clearance-live-${companyId}`)
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

  // Defensive: hide items that are already cleared so they don't linger on the station
  // even if the auto_advance trigger hasn't moved them off `clearance` phase yet.
  const visibleItems = (data || []).filter((i) => i.evidence_status !== "cleared");

  const byProject = new Map<string, {
    label: string;
    customerName: string | null;
    projectName: string | null;
    barlistName: string | null;
    barlistRevisionNo: number | null;
    barlistStatus: string | null;
    cutPlanStatus: string | null;
    items: ClearanceItem[];
  }>();
  for (const item of visibleItems) {
    // Group by cut_plan_id so each manifest is keyed by its remark (extract session / plan name),
    // matching the "Remark" printed on the rebar tag instead of the project address.
    const key = item.cut_plan_id || "__unassigned__";
    const label = item.plan_name || item.project_name || "Unassigned";
    if (!byProject.has(key)) {
      byProject.set(key, {
        label,
        customerName: item.customer_name,
        projectName: item.project_name,
        barlistName: item.barlist_name || item.plan_name,
        barlistRevisionNo: item.barlist_revision_no,
        barlistStatus: item.barlist_status,
        cutPlanStatus: item.cut_plan_status,
        items: [],
      });
    }
    byProject.get(key)!.items.push(item);
  }

  // Flatten to Map<label, items> for backward compat with ClearanceStation consumer.
  const byProjectLabel = new Map<string, ClearanceItem[]>();
  for (const [, group] of byProject) {
    const existing = byProjectLabel.get(group.label);
    if (existing) {
      existing.push(...group.items);
    } else {
      byProjectLabel.set(group.label, [...group.items]);
    }
  }

  return {
    items: data ?? [],
    clearedCount,
    totalCount,
    byProject: byProjectLabel,
    // Stable, project_id-keyed grouping so the manifest page can survive
    // label changes and last-item completion without losing context.
    byProjectKey: byProject,
    isLoading,
    error,
  };
}
