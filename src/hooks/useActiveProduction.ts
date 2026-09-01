import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEffect } from "react";

export interface ActiveProductionItem {
  id: string; // machine_run id
  machine_id: string;
  machine_name: string;
  process: string;
  status: string;
  started_at: string | null;
  notes: string | null;
  input_qty: number | null;
  output_qty: number | null;
  operator_name: string | null;
  // From joined work_order / project
  work_order_id: string | null;
  work_order_number: string | null;
  project_name: string | null;
  customer_name: string | null;
  // Item-phase data
  total_pieces: number;
  completed_pieces: number;
  bend_completed_pieces: number;
  current_phase: string | null;
}

export function useActiveProduction() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["active-production", companyId],
    enabled: !!user && !!companyId,
    refetchInterval: 5000, // Refresh every 5s — this is live data
    queryFn: async () => {
      // 1. Fetch running machine_runs with machine info
      const { data: runs, error: runsErr } = await supabase
        .from("machine_runs")
        .select(`
          id,
          machine_id,
          process,
          status,
          started_at,
          notes,
          input_qty,
          output_qty,
          work_order_id,
          machines:machine_id(name, current_operator_profile_id, operator:profiles!current_operator_profile_id(full_name))
        `)
        .eq("company_id", companyId!)
        .in("status", ["running", "paused"]);
      if (runsErr) throw runsErr;

      const runList = (runs || []) as any[];
      if (runList.length === 0) return [];

      // 2. Fetch work_order details for customer/project info
      const woIds = [...new Set(runList.map((r) => r.work_order_id).filter(Boolean))] as string[];
      let woMap = new Map<string, { work_order_number: string; project_name: string; customer_name: string }>();
      if (woIds.length > 0) {
        const { data: woData } = await supabase
          .from("work_orders")
          .select("id, work_order_number, project_name, customer_name")
          .in("id", woIds);
        for (const wo of (woData || []) as any[]) {
          woMap.set(wo.id, {
            work_order_number: wo.work_order_number,
            project_name: wo.project_name,
            customer_name: wo.customer_name,
          });
        }
      }

      // 3. Fetch item-phase progress from cut_plan_items for these runs
      // machine_runs don't directly FK to cut_plan_items, but we can link via work_order_id
      // For now aggregate all cut_plan_items by work_order_id
      let itemMap = new Map<
        string,
        { total_pieces: number; completed_pieces: number; bend_completed_pieces: number; current_phase: string | null }
      >();
      if (woIds.length > 0) {
        const { data: items } = await supabase
          .from("cut_plan_items")
          .select("work_order_id, total_pieces, completed_pieces, bend_completed_pieces, phase")
          .in("work_order_id", woIds);
        for (const item of (items || []) as any[]) {
          const key = item.work_order_id;
          if (!itemMap.has(key)) {
            itemMap.set(key, {
              total_pieces: 0,
              completed_pieces: 0,
              bend_completed_pieces: 0,
              current_phase: item.phase,
            });
          }
          const agg = itemMap.get(key)!;
          agg.total_pieces += item.total_pieces || 0;
          agg.completed_pieces += item.completed_pieces || 0;
          agg.bend_completed_pieces += item.bend_completed_pieces || 0;
        }
      }

      // 4. Assemble
      return runList.map((run): ActiveProductionItem => {
        const machine = run.machines as any;
        const wo = run.work_order_id ? woMap.get(run.work_order_id) : null;
        const agg = run.work_order_id ? itemMap.get(run.work_order_id) : null;

        return {
          id: run.id,
          machine_id: run.machine_id,
          machine_name: machine?.name || run.machine_id.slice(0, 6),
          process: run.process,
          status: run.status,
          started_at: run.started_at,
          notes: run.notes,
          input_qty: run.input_qty,
          output_qty: run.output_qty,
          operator_name: machine?.operator?.full_name || null,
          work_order_id: run.work_order_id,
          work_order_number: wo?.work_order_number || null,
          project_name: wo?.project_name || null,
          customer_name: wo?.customer_name || null,
          total_pieces: agg?.total_pieces || 0,
          completed_pieces: agg?.completed_pieces || 0,
          bend_completed_pieces: agg?.bend_completed_pieces || 0,
          current_phase: agg?.current_phase || null,
        };
      });
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`active-production-${companyId || "global"}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machine_runs" },
        () => queryClient.invalidateQueries({ queryKey: ["active-production", companyId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plan_items" },
        () => queryClient.invalidateQueries({ queryKey: ["active-production", companyId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machines" },
        () => queryClient.invalidateQueries({ queryKey: ["active-production", companyId] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, companyId, queryClient]);

  return {
    items: data ?? [],
    isLoading,
    error,
  };
}
