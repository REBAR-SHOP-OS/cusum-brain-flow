import { useMemo, useCallback } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useCutPlans, CutPlan } from "@/hooks/useCutPlans";
import { useProductionQueues } from "@/hooks/useProductionQueues";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { MaterialFlowDiagram } from "@/components/shopfloor/MaterialFlowDiagram";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { MachineGroupSection } from "@/components/shopfloor/MachineGroupSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Radio, Loader2, Settings, ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Navigate } from "react-router-dom";
import { useTabletPin } from "@/hooks/useTabletPin";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/brand-logo.png";

export default function StationDashboard() {
  const { machines, isLoading, error } = useLiveMonitorData();
  const { plans, loading: plansLoading, updatePlanStatus } = useCutPlans();
  const { projectLanes } = useProductionQueues();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pinnedMachineId } = useTabletPin();
  const queryClient = useQueryClient();

  const assignToMachine = useCallback(async (planId: string, machineId: string) => {
    await supabase.from("cut_plans").update({ machine_id: machineId }).eq("id", planId);
    queryClient.invalidateQueries({ queryKey: ["cut-plans"] });
    toast({ title: "Assigned", description: "Plan assigned to machine" });
  }, [queryClient, toast]);
  // Build a machine name lookup
  const machineMap = new Map(machines.map(m => [m.id, m.name]));

  // Sort helper: customer_name ASC nulls last, then name ASC
  const sortPlans = (a: CutPlan, b: CutPlan) => {
    const ca = (a.customer_name || "").toLowerCase();
    const cb = (b.customer_name || "").toLowerCase();
    if (!a.customer_name && b.customer_name) return 1;
    if (a.customer_name && !b.customer_name) return -1;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  };

  // Group plans by machine
  const machineGroups = useMemo(() => {
    const groups = new Map<string | null, { running: CutPlan[]; queued: CutPlan[] }>();
    for (const plan of plans) {
      const key = plan.machine_id || null;
      if (!groups.has(key)) groups.set(key, { running: [], queued: [] });
      const g = groups.get(key)!;
      if (plan.status === "running") g.running.push(plan);
      else if (["draft", "ready", "queued"].includes(plan.status)) g.queued.push(plan);
    }
    for (const g of groups.values()) {
      g.running.sort(sortPlans);
      g.queued.sort(sortPlans);
    }
    const assigned: { machineId: string; name: string; running: CutPlan[]; queued: CutPlan[] }[] = [];
    const unassigned = groups.get(null);
    groups.forEach((g, key) => {
      if (key) assigned.push({ machineId: key, name: machineMap.get(key) || key, ...g });
    });
    assigned.sort((a, b) => a.name.localeCompare(b.name));
    return { assigned, unassigned: unassigned || { running: [], queued: [] } };
  }, [plans, machines]);

  // For ActiveProductionHub compatibility
  const runningPlans = plans.filter(p => p.status === "running");
  const queuedPlans = plans.filter(p => ["draft", "ready", "queued"].includes(p.status));

  // Auto-redirect if a machine is pinned to this device
  if (pinnedMachineId && !isLoading) {
    return <Navigate to={`/shopfloor/station/${pinnedMachineId}`} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive gap-3 py-20">
        <AlertTriangle className="w-12 h-12 opacity-60" />
        <p className="text-sm">Failed to load station data</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <img src={brandLogo} alt="Logo" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">
              Station Dashboard
            </h1>
            <p className="text-[9px] tracking-[0.15em] uppercase text-primary">
              ◉ Cloud Synced / Real-Time Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex">
            <Cloud className="w-3 h-3 text-primary" />
            Cloud Synced
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            Real-Time Active
          </Badge>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <MaterialFlowDiagram />
            <ActiveProductionHub machines={machines} activePlans={[...runningPlans, ...queuedPlans]} />

            {/* Machine-grouped sections */}
            <div className="space-y-4">
              {machineGroups.assigned.map(group => (
                <MachineGroupSection
                  key={group.machineId}
                  machineName={group.name}
                  runningPlans={group.running}
                  queuedPlans={group.queued}
                  onUpdateStatus={updatePlanStatus}
                  onStatusChanged={(name, action) => toast({ title: action, description: name })}
                />
              ))}
              {(machineGroups.unassigned.running.length > 0 || machineGroups.unassigned.queued.length > 0) && (
                <MachineGroupSection
                  machineName="Unassigned"
                  runningPlans={machineGroups.unassigned.running}
                  queuedPlans={machineGroups.unassigned.queued}
                  onUpdateStatus={updatePlanStatus}
                  onStatusChanged={(name, action) => toast({ title: action, description: name })}
                  availableMachines={machines.map(m => ({ id: m.id, name: m.name }))}
                  onAssignMachine={assignToMachine}
                />
              )}
            </div>

            <MachineSelector machines={machines} />
          </>
        )}
      </div>
    </div>
  );
}

StationDashboard.displayName = "StationDashboard";
