import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface ArchiveRow {
  evidence_id: string;
  cut_plan_item_id: string;
  cut_plan_id: string | null;
  project_id: string | null;
  mark_number: string | null;
  bar_code: string | null;
  drawing_ref: string | null;
  cut_length_mm: number | null;
  total_pieces: number | null;
  manifest_label: string | null;
  project_name: string | null;
  customer_name: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verification_method: string;
  material_photo_url: string | null;
  tag_scan_url: string | null;
}

export interface ArchiveFilters {
  projectId?: string | null;
  cutPlanId?: string | null;
  verifiedBy?: string | null;
  fromDate?: string | null; // ISO
  toDate?: string | null;   // ISO
}

export function useClearanceArchive(filters: ArchiveFilters, limit = 50) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["clearance-archive", companyId, filters, limit],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("clearance_evidence")
        .select(
          `id, cut_plan_item_id, material_photo_url, tag_scan_url, verified_at, verified_by, verification_method, status,
           cut_plan_items!inner(id, mark_number, bar_code, drawing_ref, cut_length_mm, total_pieces, cut_plan_id,
             cut_plans!inner(id, name, project_id, company_id, project_name,
               projects(id, name, customers(name)),
               barlists(name, revision_no)))`
        )
        .eq("status", "cleared")
        .eq("cut_plan_items.cut_plans.company_id", companyId!)
        .order("verified_at", { ascending: false })
        .limit(limit);

      if (filters.fromDate) q = q.gte("verified_at", filters.fromDate);
      if (filters.toDate) q = q.lte("verified_at", filters.toDate);
      if (filters.verifiedBy) q = q.eq("verified_by", filters.verifiedBy);
      if (filters.cutPlanId)
        q = q.eq("cut_plan_items.cut_plan_id", filters.cutPlanId);
      if (filters.projectId)
        q = q.eq("cut_plan_items.cut_plans.project_id", filters.projectId);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as any[];

      // Resolve verifier names in one batch
      const verifierIds = [
        ...new Set(rows.map((r) => r.verified_by).filter(Boolean)),
      ] as string[];
      const nameMap = new Map<string, string>();
      if (verifierIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", verifierIds);
        (profs || []).forEach((p: any) => nameMap.set(p.id, p.full_name));
      }

      const archive: ArchiveRow[] = rows.map((r) => {
        const item = r.cut_plan_items;
        const plan = item?.cut_plans;
        const barlist = plan?.barlists;
        const manifestLabel =
          (barlist?.name && (typeof barlist?.revision_no === "number"
            ? `${barlist.name} R${barlist.revision_no}`
            : barlist.name)) ||
          plan?.name ||
          null;
        return {
          evidence_id: r.id,
          cut_plan_item_id: r.cut_plan_item_id,
          cut_plan_id: item?.cut_plan_id ?? null,
          project_id: plan?.project_id ?? null,
          mark_number: item?.mark_number ?? null,
          bar_code: item?.bar_code ?? null,
          drawing_ref: item?.drawing_ref ?? null,
          cut_length_mm: item?.cut_length_mm ?? null,
          total_pieces: item?.total_pieces ?? null,
          manifest_label: manifestLabel,
          project_name: plan?.projects?.name ?? plan?.project_name ?? null,
          customer_name: plan?.projects?.customers?.name ?? null,
          verified_at: r.verified_at ?? null,
          verified_by: r.verified_by ?? null,
          verified_by_name: r.verified_by ? nameMap.get(r.verified_by) || null : null,
          verification_method: r.verification_method || "manual",
          material_photo_url: r.material_photo_url ?? null,
          tag_scan_url: r.tag_scan_url ?? null,
        };
      });

      return archive;
    },
  });
}

/** Resolve a storage URL or path to a signed URL for the private bucket. */
export async function resolveClearancePhotoUrl(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (stored.includes("/object/sign/") || stored.includes("token=")) return stored;
  let path = stored;
  const marker = "/object/public/clearance-photos/";
  const idx = stored.indexOf(marker);
  if (idx !== -1) path = stored.substring(idx + marker.length);
  const { data } = await supabase.storage
    .from("clearance-photos")
    .createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
