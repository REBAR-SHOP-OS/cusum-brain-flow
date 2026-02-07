import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import type { LiveMachine, QueuedRun } from "@/types/machine";

export function useLiveMonitorData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: machines,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["live-machines"],
    enabled: !!user,
    queryFn: async () => {
      // Fetch machines with joined operator name & current run
      const { data, error } = await (supabase as any)
        .from("machines")
        .select(
          `*,
           operator:profiles!current_operator_profile_id(id, full_name),
           current_run:machine_runs!current_run_id(id, status, process, started_at, notes)`
        )
        .order("name");
      if (error) throw error;

      const machineList = (data || []) as LiveMachine[];

      // Fetch queued runs for all machines in one query
      const machineIds = machineList.map(m => m.id);
      if (machineIds.length > 0) {
        const { data: queuedRuns } = await supabase
          .from("machine_runs")
          .select("id, machine_id, process, status, input_qty, notes, created_at")
          .in("machine_id", machineIds)
          .eq("status", "queued")
          .order("created_at", { ascending: true });

        if (queuedRuns) {
          const runsByMachine = new Map<string, QueuedRun[]>();
          for (const run of queuedRuns) {
            const machineId = (run as any).machine_id as string;
            if (!runsByMachine.has(machineId)) runsByMachine.set(machineId, []);
            runsByMachine.get(machineId)!.push({
              id: run.id,
              process: run.process,
              status: run.status,
              input_qty: run.input_qty,
              notes: run.notes,
              created_at: run.created_at,
            });
          }
          for (const machine of machineList) {
            machine.queued_runs = runsByMachine.get(machine.id) || [];
          }
        }
      }

      return machineList;
    },
  });

  // Available operators for assignment dropdown
  const { data: operators } = useQuery({
    queryKey: ["available-operators"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscriptions for both tables
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("live-monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machines" },
        () => queryClient.invalidateQueries({ queryKey: ["live-machines"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machine_runs" },
        () => queryClient.invalidateQueries({ queryKey: ["live-machines"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    machines: machines ?? [],
    operators: operators ?? [],
    isLoading,
    error,
  };
}
