import { useMemo } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useSupabaseWorkOrders } from "@/hooks/useSupabaseWorkOrders";
import { useProductionQueues } from "@/hooks/useProductionQueues";
import { useCutPlans } from "@/hooks/useCutPlans";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { MaterialFlowDiagram } from "@/components/shopfloor/MaterialFlowDiagram";
import { ShopFloorProductionQueue } from "@/components/shopfloor/ShopFloorProductionQueue";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { WorkOrderQueueSection } from "@/components/shopfloor/WorkOrderQueueSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Radio, Loader2, Settings, ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Navigate } from "react-router-dom";
import { useTabletPin } from "@/hooks/useTabletPin";
import brandLogo from "@/assets/brand-logo.png";

export default function StationDashboard() {
  const { machines, isLoading, error } = useLiveMonitorData();
  const { data: workOrders, loading: woLoading, updateStatus } = useSupabaseWorkOrders();
  const { projectLanes } = useProductionQueues();
  const { plans: cutPlans, loading: plansLoading } = useCutPlans();
  const activePlans = useMemo(() => cutPlans.filter(p => ["running", "queued"].includes(p.status)), [cutPlans]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pinnedMachineId } = useTabletPin();

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
        {isLoading || woLoading || plansLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <MaterialFlowDiagram />
            <ShopFloorProductionQueue />
            <ActiveProductionHub machines={machines} activePlans={activePlans} />

            {/* Work Order Queue */}
            <WorkOrderQueueSection
              workOrders={workOrders}
              onUpdateStatus={updateStatus}
              onStatusChanged={(name, action) => toast({ title: action, description: name })}
            />

            <MachineSelector machines={machines} />
          </>
        )}
      </div>
    </div>
  );
}

StationDashboard.displayName = "StationDashboard";
