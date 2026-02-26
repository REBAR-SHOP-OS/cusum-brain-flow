import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface ProductionJob {
  id: string;
  name: string;
  project_name: string | null;
  status: string;
  created_at: string;
  total_pieces: number;
  completed_pieces: number;
  total_weight_kg: number;
  completed_weight_kg: number;
  elapsed_seconds: number;
}

export interface ClearedJob {
  id: string;
  name: string;
  status: string;
  completed_at: string;
  total_pieces: number;
  completed_pieces: number;
}

export function useLiveMonitorStats() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  // Fetch production jobs with weight calculations
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["live-monitor-jobs"],
    enabled: !!user,
    queryFn: async () => {
      // Get all cut plans with aggregated stats
      const { data, error } = await supabase.rpc("get_production_stats" as any);
      
      if (error) {
        // Fallback: manual query
        let query = (supabase as any)
          .from("cut_plans")
          .select(`
            id, name, project_name, status, created_at, updated_at,
            cut_plan_items(
              total_pieces, completed_pieces, cut_length_mm, bar_code,
              rebar_sizes:bar_code(mass_kg_per_m)
            )
          `)
          .in("status", ["draft", "ready", "queued", "running", "staged"])
          .order("created_at", { ascending: false });
        if (companyId) query = query.eq("company_id", companyId);
        const { data: plans, error: planError } = await query;

        if (planError) throw planError;

        const now = Date.now();
        return ((plans as any[]) || []).map((plan: any) => {
          const items = plan.cut_plan_items || [];
          let totalPieces = 0;
          let completedPieces = 0;
          let totalWeightKg = 0;
          let completedWeightKg = 0;

          for (const item of items) {
            totalPieces += item.total_pieces || 0;
            completedPieces += item.completed_pieces || 0;
            const massPerM = item.rebar_sizes?.mass_kg_per_m || 0;
            const lengthM = (item.cut_length_mm || 0) / 1000;
            totalWeightKg += (item.total_pieces || 0) * lengthM * massPerM;
            completedWeightKg += (item.completed_pieces || 0) * lengthM * massPerM;
          }

          const createdAt = new Date(plan.created_at).getTime();
          const elapsedSeconds = Math.floor((now - createdAt) / 1000);

          return {
            id: plan.id,
            name: plan.name,
            project_name: plan.project_name,
            status: plan.status,
            created_at: plan.created_at,
            total_pieces: totalPieces,
            completed_pieces: completedPieces,
            total_weight_kg: totalWeightKg,
            completed_weight_kg: completedWeightKg,
            elapsed_seconds: elapsedSeconds,
          } as ProductionJob;
        });
      }

      return (data || []) as ProductionJob[];
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  // Fetch completed/cleared jobs for the process clearance panel
  const { data: clearedJobs } = useQuery({
    queryKey: ["live-monitor-cleared"],
    enabled: !!user,
    queryFn: async () => {
      let query = (supabase as any)
        .from("cut_plans")
        .select(`
          id, name, status, updated_at,
          cut_plan_items(total_pieces, completed_pieces)
        `)
        .in("status", ["completed", "delivered"])
        .order("updated_at", { ascending: false })
        .limit(15);
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;

      if (error) throw error;

      return ((data as any[]) || []).map((plan: any) => {
        const items = plan.cut_plan_items || [];
        return {
          id: plan.id,
          name: plan.name,
          status: plan.status,
          completed_at: plan.updated_at,
          total_pieces: items.reduce((s: number, i: any) => s + (i.total_pieces || 0), 0),
          completed_pieces: items.reduce((s: number, i: any) => s + (i.completed_pieces || 0), 0),
        } as ClearedJob;
      });
    },
    refetchInterval: 30000,
  });

  // Realtime subscription for cut_plans and cut_plan_items
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`live-monitor-stats-${companyId || "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_plans" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-monitor-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["live-monitor-cleared"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_plan_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-monitor-jobs"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, companyId, queryClient]);

  // Aggregate stats
  const activeJobs = jobs || [];
  const totalTonnage = activeJobs.reduce((s, j) => s + j.total_weight_kg, 0) +
    (clearedJobs || []).reduce((s, j) => s + 0, 0); // Cleared jobs weight not tracked separately
  const totalPcsLogged = activeJobs.reduce((s, j) => s + j.completed_pieces, 0) +
    (clearedJobs || []).reduce((s, j) => s + j.completed_pieces, 0);

  // Calculate total tonnage from all plans (active + cleared)
  const allJobsTonnage = activeJobs.reduce((s, j) => s + j.total_weight_kg, 0);

  return {
    activeJobs,
    clearedJobs: clearedJobs || [],
    totalTonnage: allJobsTonnage,
    totalPcsLogged,
    jobsLoading,
  };
}
