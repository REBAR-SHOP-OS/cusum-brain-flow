import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, LayoutGrid, AlertTriangle } from "lucide-react";
import type { LiveMachine } from "@/types/machine";
import type { CutPlan } from "@/hooks/useCutPlans";

interface ActiveProductionHubProps {
  machines: LiveMachine[];
  activePlans?: CutPlan[];
}

export function ActiveProductionHub({ machines, activePlans = [] }: ActiveProductionHubProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Machines that are running or have queued runs
  const workingMachines = machines.filter(
    (m) => m.status === "running" || (m.queued_runs && m.queued_runs.length > 0)
  );

  // Also include machines that have cut plans assigned but aren't in the working list yet
  const machinesWithPlans = new Set(
    activePlans
      .filter(p => p.machine_id && ["queued", "running"].includes(p.status))
      .map(p => p.machine_id!)
  );

  const additionalMachines = machines.filter(
    m => machinesWithPlans.has(m.id) && !workingMachines.some(wm => wm.id === m.id)
  );

  const allWorkingMachines = [...workingMachines, ...additionalMachines];

  // Unassigned running/queued plans
  const unassignedPlans = activePlans.filter(p => !p.machine_id && ["running", "queued"].includes(p.status));

  // Fetch aggregated progress from cut_plan_items
  const planIds = activePlans.map(p => p.id);
  const { data: itemAggregates } = useQuery({
    queryKey: ["production-hub-progress", planIds],
    enabled: planIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cut_plan_items")
        .select("cut_plan_id, total_pieces, completed_pieces")
        .in("cut_plan_id", planIds);
      return data || [];
    },
  });

  // Compute per-machine progress
  const machineProgress = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    if (!itemAggregates) return map;
    for (const item of itemAggregates) {
      const plan = activePlans.find(p => p.id === item.cut_plan_id);
      if (!plan?.machine_id) continue;
      const entry = map.get(plan.machine_id) || { total: 0, completed: 0 };
      entry.total += item.total_pieces || 0;
      entry.completed += item.completed_pieces || 0;
      map.set(plan.machine_id, entry);
    }
    return map;
  }, [itemAggregates, activePlans]);

  // Count plans per machine for display
  const plansByMachine = new Map<string, CutPlan[]>();
  for (const plan of activePlans) {
    if (plan.machine_id) {
      if (!plansByMachine.has(plan.machine_id)) plansByMachine.set(plan.machine_id, []);
      plansByMachine.get(plan.machine_id)!.push(plan);
    }
  }

  const assignToMachine = async (planId: string, machineId: string) => {
    await supabase.from("cut_plans").update({ machine_id: machineId }).eq("id", planId);
    queryClient.invalidateQueries({ queryKey: ["cut-plans"] });
    queryClient.invalidateQueries({ queryKey: ["production-hub-progress"] });
  };

  // Hide entirely when nothing is actively producing
  const hasAnyProgress = [...machineProgress.values()].some(p => p.total > 0);
  if (allWorkingMachines.length === 0 && unassignedPlans.length === 0) return null;
  if (activePlans.length === 0 && !hasAnyProgress && allWorkingMachines.every(m => m.status !== "running")) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black italic tracking-wide uppercase text-primary">
              Active Production Hub
            </h2>
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              Select project to start fabrication
            </p>
          </div>
        </div>
        <Badge className="bg-success/20 text-success border-success/30">
          {allWorkingMachines.length} WORKING
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {allWorkingMachines.map((machine) => {
          const machinePlans = plansByMachine.get(machine.id) || [];
          const planCount = machinePlans.length;

          return (
            <div
              key={machine.id}
              className="rounded-xl border-2 border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] font-mono">
                  #{machine.name}
                </Badge>
                <div className="flex items-center gap-2">
                  {planCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {planCount} job{planCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {machine.status === "running" && (
                    <span className="text-xs text-success font-mono flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-black text-foreground">
                {machine.model || machine.name}
              </h3>

              {machinePlans.length > 0 && (
                <div className="space-y-1">
                  {machinePlans.slice(0, 3).map(plan => (
                    <p key={plan.id} className="text-xs text-muted-foreground truncate">
                      • {plan.name}
                    </p>
                  ))}
                  {machinePlans.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{machinePlans.length - 3} more
                    </p>
                  )}
                </div>
              )}

              {(() => {
                const prog = machineProgress.get(machine.id);
                const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="tracking-wider uppercase">Total Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                      {prog?.completed || 0} / {prog?.total || 0} pieces
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 gap-2 font-bold"
                  onClick={() => navigate(`/shopfloor/station/${machine.id}`)}
                >
                  <Play className="w-4 h-4" />
                  Enter Station
                </Button>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Pause className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Unassigned plans card */}
        {unassignedPlans.length > 0 && (
          <div className="rounded-xl border-2 border-dashed border-warning/50 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-black italic tracking-wide uppercase text-warning">
                  Unassigned Jobs
                </span>
              </div>
              <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
                {unassignedPlans.length} PLAN{unassignedPlans.length !== 1 ? "S" : ""}
              </Badge>
            </div>
            <div className="space-y-3">
              {unassignedPlans.map(plan => (
                <div key={plan.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${plan.status === "running" ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
                  <span className="text-xs font-bold text-foreground truncate flex-1">{plan.name}</span>
                  <Select onValueChange={(machineId) => assignToMachine(plan.id, machineId)}>
                    <SelectTrigger className="w-[160px] h-7 text-[10px] bg-card">
                      <SelectValue placeholder="Assign to machine" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      {machines.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
