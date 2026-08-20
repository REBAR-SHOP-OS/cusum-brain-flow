import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/lib/auth";
import type {
  ManifestReleaseState,
  BundleReleaseState,
  ItemSubState,
} from "@/lib/releaseStateLabels";

/**
 * Reads the unified `v_workflow_release_state` view so any screen
 * (Pickup, Clearance, etc.) renders identical state labels per manifest,
 * bundle, and item. The view is security_invoker so this query
 * automatically inherits the same row visibility as the underlying
 * cut_plans / cut_plan_items / clearance_evidence tables.
 */
export interface ReleaseStateRow {
  item_id: string;
  manifest_id: string;
  company_id: string;
  item_phase: string | null;
  item_sub_state: ItemSubState;
  evidence_status_raw: string | null;
  evidence_complete: boolean | null;
  fulfillment_channel: string | null;
  delivery_id: string | null;
  pickup_id: string | null;
  loading_list_id: string | null;
  manifest_release_state: ManifestReleaseState;
  manifest_status_raw: string | null;
  total_items: number;
  released_items: number;
  bundle_release_state: BundleReleaseState;
}

export function useReleaseState() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();

  const query = useQuery({
    queryKey: ["workflow-release-state", companyId],
    enabled: !!user && !!companyId,
    queryFn: async (): Promise<ReleaseStateRow[]> => {
      // View is not in generated types yet; cast through `any`.
      const { data, error } = await (supabase as any)
        .from("v_workflow_release_state")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data || []) as ReleaseStateRow[];
    },
    staleTime: 15_000,
  });

  const rows = query.data ?? [];

  const itemSubStateById = new Map<string, ItemSubState>();
  const manifestStateById = new Map<string, ManifestReleaseState>();
  for (const r of rows) {
    itemSubStateById.set(r.item_id, r.item_sub_state);
    manifestStateById.set(r.manifest_id, r.manifest_release_state);
  }

  return {
    rows,
    itemSubStateById,
    manifestStateById,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
