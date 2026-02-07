import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, LayoutGrid } from "lucide-react";
import type { LiveMachine } from "@/types/machine";
import type { CutPlan } from "@/hooks/useCutPlans";

interface ActiveProductionHubProps {
  machines: LiveMachine[];
  activePlans?: CutPlan[];
}

export function ActiveProductionHub({ machines, activePlans = [] }: ActiveProductionHubProps) {
  const navigate = useNavigate();

  // Machines that are running or have queued runs
  const workingMachines = machines.filter(
    (m) => m.status === "running" || (m.queued_runs && m.queued_runs.length > 0)
  );

  // Also include machines that have cut plans assigned but aren't in the working list yet
  const machinesWithPlans = new Set(
    activePlans
      .filter(p => p.machine_id && ["queued", "in_progress"].includes(p.status))
      .map(p => p.machine_id!)
  );

  const additionalMachines = machines.filter(
    m => machinesWithPlans.has(m.id) && !workingMachines.some(wm => wm.id === m.id)
  );

  const allWorkingMachines = [...workingMachines, ...additionalMachines];

  // Count plans per machine for display
  const plansByMachine = new Map<string, CutPlan[]>();
  for (const plan of activePlans) {
    if (plan.machine_id) {
      if (!plansByMachine.has(plan.machine_id)) plansByMachine.set(plan.machine_id, []);
      plansByMachine.get(plan.machine_id)!.push(plan);
    }
  }

  if (allWorkingMachines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-muted-foreground text-sm">No machines currently running</p>
      </div>
    );
  }

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
          const queuedCount = machine.queued_runs?.length || 0;
          const machinePlans = plansByMachine.get(machine.id) || [];
          const planCount = machinePlans.length;

          return (
            <div
              key={machine.id}
              className="rounded-xl border-2 border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-all"
            >
              {/* Job header */}
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

              {/* Machine / project name */}
              <h3 className="text-xl font-black text-foreground">
                {machine.model || machine.name}
              </h3>

              {/* Show assigned plans */}
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

              {/* Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="tracking-wider uppercase">Total Progress</span>
                  <span>0%</span>
                </div>
                <Progress value={0} className="h-1.5" />
              </div>

              {/* Actions */}
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
      </div>
    </div>
  );
}
