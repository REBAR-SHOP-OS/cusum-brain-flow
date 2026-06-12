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
  ref_no: string | null;
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
  storage_zone: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  created_at: string | null;
  // ---- Triage / sample-data extensions (derived, never written) ----
  is_sample: boolean;
  verification_state: string | null;
  mismatch_reason: string | null;
  triage: "cleared" | "needs_fix" | "stale" | "upstream_not_ready" | "pending";
  urgency: number; // higher = more urgent; used for sort
}

// Sample/demo data heuristic — single source of truth.
// Matches labels that start with sample / demo / test / seed (case-insensitive).
export function isSampleLabel(...parts: Array<string | null | undefined>): boolean {
  const re = /^\s*(sample|demo|test|seed)\b/i;
  return parts.some((p) => typeof p === "string" && re.test(p));
}

const STALE_HOURS = 24;
const TRIAGE_PRIORITY: Record<ClearanceItem["triage"], number> = {
  needs_fix: 100,
  stale: 80,
  upstream_not_ready: 60,
  pending: 40,
  cleared: 0,
};

export function useClearanceData() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["clearance-items", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      // Narrow column list — only fields actually consumed below. Cuts payload
      // size on the manifest load and on every realtime invalidation tick.
      const { data: items, error: itemsError } = await supabase
        .from("cut_plan_items")
        .select(
          "id, cut_plan_id, bar_code, cut_length_mm, unit_system, source_total_length_text, mark_number, drawing_ref, ref_no, asa_shape_code, total_pieces, bend_completed_pieces, ready_at, cut_plans!inner(id, name, status, project_name, project_id, company_id, barlist_id, projects(id, name, customer_id, customers(name)), barlists(name, revision_no, status))"
        )
        .eq("phase", "clearance")
        .eq("cut_plans.company_id", companyId!);

      if (itemsError) throw itemsError;
      if (!items?.length) return [];

      const itemIds = items.map((i: any) => i.id);
      const { data: evidence } = await supabase
        .from("clearance_evidence")
        .select(
          "id, cut_plan_item_id, status, verification_state, mismatch_reason, material_photo_url, tag_scan_url, storage_zone, verified_at, verified_by"
        )
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

      const nowMs = Date.now();
      return sortedItems.map((item: any) => {
        const ev = evidenceMap.get(item.id) as any;
        const plan_name = item.cut_plans?.name || "";
        const project_name = item.cut_plans?.projects?.name || item.cut_plans?.project_name || null;
        const customer_name = item.cut_plans?.projects?.customers?.name || null;
        const barlist_name = item.cut_plans?.barlists?.name || item.cut_plans?.name || null;
        const barlist_status = item.cut_plans?.barlists?.status || null;
        const cut_plan_status = item.cut_plans?.status || null;
        const evidence_status = ev?.status || "pending";
        const verification_state = ev?.verification_state || null;
        const mismatch_reason = ev?.mismatch_reason || null;
        const is_sample = isSampleLabel(plan_name, project_name, customer_name, barlist_name);

        // Triage bucket
        let triage: ClearanceItem["triage"] = "pending";
        if (evidence_status === "cleared") {
          triage = "cleared";
        } else if (mismatch_reason || verification_state === "manual_review") {
          triage = "needs_fix";
        } else {
          const blOk = !barlist_status || ["released", "approved"].includes(barlist_status);
          const cpOk = !cut_plan_status || ["cutting", "clearance", "complete"].includes(cut_plan_status);
          if (!blOk || !cpOk) {
            triage = "upstream_not_ready";
          } else {
            const createdMs = item.created_at ? new Date(item.created_at).getTime() : nowMs;
            const ageHrs = (nowMs - createdMs) / 36e5;
            if (ageHrs > STALE_HOURS) triage = "stale";
          }
        }
        const urgency = TRIAGE_PRIORITY[triage];

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
          ref_no: item.ref_no ?? null,
          asa_shape_code: item.asa_shape_code,
          total_pieces: item.total_pieces,
          bend_completed_pieces: item.bend_completed_pieces,
          plan_name,
          project_name,
          customer_name,
          barlist_name,
          barlist_revision_no: typeof item.cut_plans?.barlists?.revision_no === "number"
            ? item.cut_plans.barlists.revision_no
            : null,
          barlist_status,
          cut_plan_status,
          evidence_id: ev?.id || null,
          material_photo_url: ev?.material_photo_url || null,
          tag_scan_url: ev?.tag_scan_url || null,
          evidence_status,
          storage_zone: ev?.storage_zone ?? null,
          verified_at: ev?.verified_at || null,
          verified_by_name: ev?.verified_by ? profileMap.get(ev.verified_by) || null : null,
          created_at: item.ready_at || null,
          is_sample,
          verification_state,
          mismatch_reason,
          triage,
          urgency,
        } as ClearanceItem;
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`clearance-live-${companyId}-${crypto.randomUUID()}`)
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
    latestCreatedAt: number;
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
        latestCreatedAt: 0,
        items: [],
      });
    }
    const g = byProject.get(key)!;
    g.items.push(item);
    const t = item.created_at ? new Date(item.created_at).getTime() : 0;
    if (t > g.latestCreatedAt) g.latestCreatedAt = t;
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

  const all = data ?? [];
  const liveItems = all.filter((i) => !i.is_sample);
  const sampleItems = all.filter((i) => i.is_sample);
  const hasLive = liveItems.length > 0;

  // Triage breakdown counts (over the LIVE set when live data exists,
  // otherwise over the sample set so the operator still sees buckets).
  const triageSource = hasLive ? liveItems : sampleItems;
  const triageCounts = {
    pending: triageSource.filter((i) => i.triage === "pending").length,
    cleared: triageSource.filter((i) => i.triage === "cleared").length,
    needs_fix: triageSource.filter((i) => i.triage === "needs_fix").length,
    upstream_not_ready: triageSource.filter((i) => i.triage === "upstream_not_ready").length,
    stale: triageSource.filter((i) => i.triage === "stale").length,
  };

  return {
    items: all,
    liveItems,
    sampleItems,
    hasLive,
    sampleCount: sampleItems.length,
    triageCounts,
    clearedCount,
    totalCount,
    byProject: byProjectLabel,
    // Stable, project_id-keyed grouping so the manifest page can survive
    // label changes and last-item completion without losing context.
    byProjectKey: byProject,
    isLoading,
    isFetching,
    dataUpdatedAt,
    error,
  };
}
