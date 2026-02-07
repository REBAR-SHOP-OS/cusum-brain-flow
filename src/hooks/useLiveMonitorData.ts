import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import type { LiveMachine } from "@/types/machine";

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
           current_run:machine_runs!current_run_id(id, status, process, started_at)`
        )
        .order("name");
      if (error) throw error;
      return (data || []) as LiveMachine[];
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
