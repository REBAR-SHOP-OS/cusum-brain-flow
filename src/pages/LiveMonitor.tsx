import { useState, useMemo } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useUserRole } from "@/hooks/useUserRole";
import { manageMachine } from "@/lib/manageMachineService";
import { LiveMachineCard } from "@/components/shopfloor/LiveMachineCard";
import { MachineFilters } from "@/components/shopfloor/MachineFilters";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Factory,
  Loader2,
  Play,
  AlertTriangle,
  XCircle,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

export default function LiveMonitor() {
  const { machines, operators, isLoading, error } = useLiveMonitorData();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  // Derive unique warehouses
  const warehouses = useMemo(() => {
    const ids = new Set<string>();
    machines.forEach((m) => {
      if (m.warehouse_id) ids.add(m.warehouse_id);
    });
    return Array.from(ids);
  }, [machines]);

  // Filter machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter)
        return false;
      return true;
    });
  }, [machines, typeFilter, statusFilter, warehouseFilter]);

  // Stats
  const runningCount = machines.filter((m) => m.status === "running").length;
  const blockedCount = machines.filter((m) => m.status === "blocked").length;
  const downCount = machines.filter((m) => m.status === "down").length;

  const handleAction = async (
    machineId: string,
    action: string,
    params?: Record<string, unknown>
  ) => {
    try {
      await manageMachine({
        action: action as any,
        machineId,
        ...params,
      });
      toast.success(
        `${action.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())} successful`
      );
    } catch (err: any) {
      toast.error(err.message || "Action failed");
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
            {machines.length} machine{machines.length !== 1 ? "s" : ""} •
            Real-time
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 text-xs text-[hsl(var(--success))]"
        >
          <Wifi className="w-3 h-3" />
          Live
        </Badge>
      </header>

      {/* Stats */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-muted/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total"
            value={machines.length}
            icon={<Factory className="w-4 h-4 text-primary" />}
          />
          <StatCard
            label="Running"
            value={runningCount}
            icon={<Play className="w-4 h-4 text-[hsl(var(--success))]" />}
          />
          <StatCard
            label="Blocked"
            value={blockedCount}
            icon={
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
            }
          />
          <StatCard
            label="Down"
            value={downCount}
            icon={<XCircle className="w-4 h-4 text-destructive" />}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 py-3 border-b border-border">
        <MachineFilters
          warehouses={warehouses}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          warehouseFilter={warehouseFilter}
          onTypeChange={setTypeFilter}
          onStatusChange={setStatusFilter}
          onWarehouseChange={setWarehouseFilter}
        />
      </div>

      {/* Machine grid */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-destructive">
            <p>Failed to load machines</p>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <Factory className="w-10 h-10" />
            <p>
              {machines.length === 0
                ? "No machines configured yet"
                : "No machines match filters"}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 sm:p-6">
              {filteredMachines.map((machine) => (
                <LiveMachineCard
                  key={machine.id}
                  machine={machine}
                  canWrite={canWrite}
                  operators={operators}
                  onAction={handleAction}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
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
