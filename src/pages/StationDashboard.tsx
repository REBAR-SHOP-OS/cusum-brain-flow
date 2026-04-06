import { useMemo, useEffect, useState } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useSupabaseWorkOrders } from "@/hooks/useSupabaseWorkOrders";
import { useProductionQueues } from "@/hooks/useProductionQueues";
import { useCutPlans } from "@/hooks/useCutPlans";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { MaterialFlowDiagram } from "@/components/shopfloor/MaterialFlowDiagram";
import { ShopFloorProductionQueue } from "@/components/shopfloor/ShopFloorProductionQueue";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { WorkOrderQueueSection } from "@/components/shopfloor/WorkOrderQueueSection";
import { DowntimeAlertBanner } from "@/components/shopfloor/DowntimeAlertBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Radio, Loader2, Settings, ArrowLeft, AlertTriangle, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Navigate } from "react-router-dom";
import { useTabletPin } from "@/hooks/useTabletPin";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/brand-logo.png";
import type { MachineType, MachineStatus } from "@/types/machine";
import { getCurrentShift, getShiftLabel, type ShiftType } from "@/lib/shiftUtils";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";

export default function StationDashboard() {
  const { timezone } = useWorkspaceSettings();
  const { machines, isLoading, error } = useLiveMonitorData();
  const { data: workOrders, loading: woLoading, updateStatus } = useSupabaseWorkOrders();
  const { projectLanes } = useProductionQueues();
  const { plans: cutPlans, loading: plansLoading } = useCutPlans();
  const activePlans = useMemo(() => cutPlans.filter(p => ["running", "queued"].includes(p.status)), [cutPlans]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pinnedMachineId } = useTabletPin();
  const queryClient = useQueryClient();

  // Filter state
  const [typeFilter, setTypeFilter] = useState<MachineType | "all">("all");
  const [statusFilters, setStatusFilters] = useState<Set<MachineStatus>>(new Set());
  const [shiftFilter, setShiftFilter] = useState<ShiftType>(() => getCurrentShift(timezone));

  useEffect(() => {
    setShiftFilter(getCurrentShift(timezone));
  }, [timezone]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (statusFilters.size > 0 && !statusFilters.has(m.status)) return false;
      return true;
    });
  }, [machines, typeFilter, statusFilters]);

  const toggleStatus = (s: MachineStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Realtime subscription for work_orders table
  useEffect(() => {
    const channel = supabase
      .channel("work-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["work-orders"] });
          queryClient.invalidateQueries({ queryKey: ["production-queues"] });
          queryClient.invalidateQueries({ queryKey: ["cut-plans"] });
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {isLoading || woLoading || plansLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Downtime alerts */}
            <DowntimeAlertBanner machines={machines} />

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MachineType | "all")}
                className="h-8 rounded-md border border-border bg-card px-2.5 text-xs font-bold uppercase tracking-wider text-foreground"
              >
                <option value="all">All Types</option>
                <option value="cutter">Cutters</option>
                <option value="bender">Benders</option>
                <option value="loader">Loaders</option>
              </select>

              {/* Status chips */}
              {(["running", "idle", "blocked", "down"] as MachineStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`h-7 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    statusFilters.has(s)
                      ? s === "running" ? "bg-success/20 text-success border-success/40"
                      : s === "idle" ? "bg-muted text-muted-foreground border-border"
                      : s === "blocked" ? "bg-warning/20 text-warning border-warning/40"
                      : "bg-destructive/20 text-destructive border-destructive/40"
                      : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {s}
                </button>
              ))}

              {/* Shift toggle */}
              <div className="ml-auto flex items-center gap-1">
                {(["day", "night", "all"] as ShiftType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShiftFilter(s)}
                    className={`h-7 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 ${
                      shiftFilter === s
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                  >
                    {s === "day" && <Sun className="w-3 h-3" />}
                    {s === "night" && <Moon className="w-3 h-3" />}
                    {getShiftLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <MaterialFlowDiagram />
            <ShopFloorProductionQueue />
            <ActiveProductionHub machines={filteredMachines} activePlans={activePlans} />

            {/* Work Order Queue */}
            <WorkOrderQueueSection
              workOrders={workOrders}
              onUpdateStatus={updateStatus}
              onStatusChanged={(name, action) => toast({ title: action, description: name })}
            />

            <MachineSelector machines={filteredMachines} />
          </>
        )}
      </div>
    </div>
  );
}

StationDashboard.displayName = "StationDashboard";
