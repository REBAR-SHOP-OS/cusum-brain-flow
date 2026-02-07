import { useState, useMemo } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useProductionQueues } from "@/hooks/useProductionQueues";
import { useUserRole } from "@/hooks/useUserRole";
import { manageMachine } from "@/lib/manageMachineService";
import { smartDispatch } from "@/lib/dispatchService";
import { LiveMachineCard } from "@/components/shopfloor/LiveMachineCard";
import { ProjectLanesView } from "@/components/shopfloor/ProjectLanesView";
import { MachineFilters } from "@/components/shopfloor/MachineFilters";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Factory,
  Loader2,
  Play,
  AlertTriangle,
  XCircle,
  Wifi,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

export default function LiveMonitor() {
  const { machines, operators, isLoading, error } = useLiveMonitorData();
  const { projectLanes, queueItems } = useProductionQueues();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [viewTab, setViewTab] = useState("machines");

  const warehouses = useMemo(() => {
    const ids = new Set<string>();
    machines.forEach((m) => {
      if (m.warehouse_id) ids.add(m.warehouse_id);
    });
    return Array.from(ids);
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter) return false;
      return true;
    });
  }, [machines, typeFilter, statusFilter, warehouseFilter]);

  const runningCount = machines.filter((m) => m.status === "running").length;
  const blockedCount = machines.filter((m) => m.status === "blocked").length;
  const downCount = machines.filter((m) => m.status === "down").length;
  const activeTaskCount = queueItems.filter((q) => q.status === "running").length;

  const handleAction = async (
    machineId: string,
    action: string,
    params?: Record<string, unknown>
  ) => {
    try {
      await manageMachine({ action: action as any, machineId, ...params });
      toast.success(`${action.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())} successful`);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleStartTask = async (queueItemId: string) => {
    try {
      await smartDispatch({ action: "start-task", queueItemId });
      toast.success("Task started");
    } catch (err: any) {
      toast.error(err.message || "Failed to start task");
    }
  };

  const handleMoveTask = async (queueItemId: string, targetMachineId: string) => {
    try {
      await smartDispatch({ action: "move-task", queueItemId, targetMachineId });
      toast.success("Task moved");
    } catch (err: any) {
      toast.error(err.message || "Failed to move task");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Live Monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            {machines.length} machine{machines.length !== 1 ? "s" : ""} •{" "}
            {activeTaskCount} active task{activeTaskCount !== 1 ? "s" : ""} •
            Real-time
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs text-[hsl(var(--success))]">
          <Wifi className="w-3 h-3" />
          Live
        </Badge>
      </header>

      {/* Stats */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-muted/30">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total" value={machines.length} icon={<Factory className="w-4 h-4 text-primary" />} />
          <StatCard label="Running" value={runningCount} icon={<Play className="w-4 h-4 text-[hsl(var(--success))]" />} />
          <StatCard label="Blocked" value={blockedCount} icon={<AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />} />
          <StatCard label="Down" value={downCount} icon={<XCircle className="w-4 h-4 text-destructive" />} />
          <StatCard label="Tasks" value={queueItems.length} icon={<Layers className="w-4 h-4 text-primary" />} />
        </div>
      </div>

      {/* View tabs + Filters */}
      <div className="px-4 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="h-8">
              <TabsTrigger value="machines" className="text-xs gap-1 h-7">
                <LayoutGrid className="w-3 h-3" />
                Machines
              </TabsTrigger>
              <TabsTrigger value="projects" className="text-xs gap-1 h-7">
                <Layers className="w-3 h-3" />
                Project Lanes
                {projectLanes.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">
                    {projectLanes.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {viewTab === "machines" && (
            <MachineFilters
              warehouses={warehouses}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              warehouseFilter={warehouseFilter}
              onTypeChange={setTypeFilter}
              onStatusChange={setStatusFilter}
              onWarehouseChange={setWarehouseFilter}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-destructive">
            <p>Failed to load machines</p>
          </div>
        ) : viewTab === "machines" ? (
          filteredMachines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Factory className="w-10 h-10" />
              <p>{machines.length === 0 ? "No machines configured yet" : "No machines match filters"}</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 sm:p-6">
                {filteredMachines.map((machine) => {
                  // Find active task for this machine
                  const machineTask = queueItems.find(
                    (q) => q.machine_id === machine.id && q.status === "running"
                  );

                  return (
                    <div key={machine.id} className="space-y-2">
                      <LiveMachineCard
                        machine={machine}
                        canWrite={canWrite}
                        operators={operators}
                        onAction={handleAction}
                      />
                      {/* Current task overlay */}
                      {machineTask?.task && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-primary">
                              Active Task
                            </span>
                            <Badge variant="outline" className="text-[9px] font-mono">
                              {machineTask.task.bar_code} {machineTask.task.task_type}
                            </Badge>
                          </div>
                          {machineTask.task.mark_number && (
                            <p className="text-muted-foreground mt-0.5">
                              Mark: {machineTask.task.mark_number}
                            </p>
                          )}
                          <p className="text-muted-foreground font-mono mt-0.5">
                            {machineTask.task.qty_completed}/{machineTask.task.qty_required} pcs
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-6">
              <ProjectLanesView
                lanes={projectLanes}
                machines={machines.map((m) => ({ id: m.id, name: m.name, status: m.status }))}
                canWrite={canWrite}
                onStartTask={handleStartTask}
                onMoveTask={handleMoveTask}
              />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
      <div className="p-2 rounded-md bg-muted">{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
