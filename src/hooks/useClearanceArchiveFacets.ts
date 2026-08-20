import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useIntake } from "@/contexts/IntakeContext";

export interface ArchiveFacets {
  projects: Array<[string, string]>;
  operators: Array<[string, string]>;
}

/**
 * Fetches the FULL set of distinct projects & operators that have ever
 * produced cleared evidence for the current company/intake — independent of
 * the visible page (which is capped at 50). Without this, the project filter
 * only listed projects that appeared in the latest 50 cleared items.
 */
export function useClearanceArchiveFacets() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const { intakeId } = useIntake();

  return useQuery({
    queryKey: ["clearance-archive-facets", companyId, intakeId],
    enabled: !!user && !!companyId,
    queryFn: async (): Promise<ArchiveFacets> => {
      let q = supabase
        .from("clearance_evidence")
        .select(
          `verified_by,
           cut_plan_items!inner(
             cut_plans!inner(company_id, project_id, project_name,
               projects(id, name, customers(name))
             )
           )`
        )
        .eq("status", "cleared")
        .eq("cut_plan_items.cut_plans.company_id", companyId!)
        .limit(5000);

      if (intakeId) q = q.eq("intake_id", intakeId);

      const { data, error } = await q;
      if (error) throw error;

      const projMap = new Map<string, string>();
      const opIds = new Set<string>();
      for (const r of (data || []) as any[]) {
        const plan = r.cut_plan_items?.cut_plans;
        const pid = plan?.project_id;
        if (pid) {
          const label =
            [plan?.projects?.customers?.name, plan?.projects?.name || plan?.project_name]
              .filter(Boolean)
              .join(" / ") || pid;
          projMap.set(pid, label);
        }
        if (r.verified_by) opIds.add(r.verified_by);
      }

      const opMap = new Map<string, string>();
      if (opIds.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...opIds]);
        (profs || []).forEach((p: any) =>
          opMap.set(p.id, p.full_name || "Unknown")
        );
      }

      return {
        projects: [...projMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
        operators: [...opMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      };
    },
    staleTime: 60_000,
  });
}
