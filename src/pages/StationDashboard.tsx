import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useCutPlans } from "@/hooks/useCutPlans";
import { useProductionQueues } from "@/hooks/useProductionQueues";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { MaterialFlowDiagram } from "@/components/shopfloor/MaterialFlowDiagram";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Radio, Loader2, Settings, FolderOpen, FileText, Layers, Play, Pause, CheckCircle2, ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import brandLogo from "@/assets/brand-logo.png";

export default function StationDashboard() {
  const { machines, isLoading, error } = useLiveMonitorData();
  const { plans, loading: plansLoading, updatePlanStatus } = useCutPlans();
  const { projectLanes } = useProductionQueues();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Active cut plans (draft, ready, queued, running)
  const activePlans = plans.filter(p =>
    ["draft", "ready", "queued", "running"].includes(p.status)
  );

  // Build a machine name lookup
  const machineMap = new Map(machines.map(m => [m.id, m.name]));

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
            {/* Material Flow Diagram */}
            <MaterialFlowDiagram />

            <ActiveProductionHub machines={machines} activePlans={activePlans} />

            {/* Live Queue - Cut Plans */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {activePlans.length}
                </div>
                <h2 className="text-lg font-black italic tracking-wide uppercase text-foreground">
                  Live Queue
                </h2>
              </div>

              {plansLoading ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                </div>
              ) : activePlans.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No active jobs in queue
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activePlans.map(plan => {
                    const statusMap: Record<string, { label: string; color: string }> = {
                      draft: { label: "DRAFT", color: "bg-muted text-muted-foreground" },
                      ready: { label: "READY", color: "bg-warning/20 text-warning" },
                      queued: { label: "QUEUED", color: "bg-primary/20 text-primary" },
                      running: { label: "ACTIVE", color: "bg-success/20 text-success" },
                    };
                    const st = statusMap[plan.status] || statusMap.draft;
                    const machineName = plan.machine_id ? machineMap.get(plan.machine_id) : null;

                    return (
                      <div
                        key={plan.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors ${
                          plan.status === "running" ? "border-success/40" : "border-border"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${plan.status === "running" ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
                        <Badge className={`${st.color} text-[10px] tracking-wider shrink-0`}>
                          {st.label}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">{plan.name}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {plan.project_name && (
                              <span className="flex items-center gap-1 truncate">
                                <FolderOpen className="w-3 h-3 shrink-0" />
                                {plan.project_name}
                              </span>
                            )}
                            {machineName && (
                              <span className="flex items-center gap-1 truncate">
                                <Layers className="w-3 h-3 shrink-0" />
                                {machineName}
                              </span>
                            )}
                            {!plan.project_name && !machineName && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Unassigned
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(plan.status === "draft" || plan.status === "queued" || plan.status === "ready") && (
                            <Button
                              size="sm"
                              className="h-7 text-[10px] gap-1 px-2.5 font-bold"
                              onClick={async () => {
                                const ok = await updatePlanStatus(plan.id, "running");
                                if (ok) toast({ title: "Started", description: plan.name });
                              }}
                            >
                              <Play className="w-3 h-3" />
                              Start
                            </Button>
                          )}
                          {plan.status === "running" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2.5 font-bold border-warning/40 text-warning hover:bg-warning/10"
                                onClick={async () => {
                                  const ok = await updatePlanStatus(plan.id, "queued");
                                  if (ok) toast({ title: "Paused", description: plan.name });
                                }}
                              >
                                <Pause className="w-3 h-3" />
                                Pause
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2.5 font-bold border-success/40 text-success hover:bg-success/10"
                                onClick={async () => {
                                  const ok = await updatePlanStatus(plan.id, "completed");
                                  if (ok) toast({ title: "Completed", description: plan.name });
                                }}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Complete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
