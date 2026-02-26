import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Play, Pause, CheckCircle2, Cpu } from "lucide-react";
import { SupabaseWorkOrder } from "@/hooks/useSupabaseWorkOrders";

interface WorkOrderQueueSectionProps {
  workOrders: SupabaseWorkOrder[];
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "READY", color: "bg-primary/20 text-primary" },
  in_progress: { label: "ACTIVE", color: "bg-success/20 text-success" },
  on_hold: { label: "ON HOLD", color: "bg-warning/20 text-warning" },
  completed: { label: "DONE", color: "bg-primary/20 text-primary" },
};

export function WorkOrderQueueSection({ workOrders, onUpdateStatus, onStatusChanged }: WorkOrderQueueSectionProps) {
  const activeOrders = useMemo(() =>
    workOrders.filter(wo => wo.status === "in_progress" || wo.status === "on_hold" || wo.status === "pending"),
    [workOrders]
  );

  const groups = useMemo(() => {
    const map = new Map<string, SupabaseWorkOrder[]>();
    for (const wo of activeOrders) {
      const key = wo.workstation || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(wo);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])
    );
  }, [activeOrders]);

  if (activeOrders.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Order Queue</h2>
      {groups.map(([station, orders]) => (
        <StationGroup key={station} stationName={station} orders={orders} onUpdateStatus={onUpdateStatus} onStatusChanged={onStatusChanged} />
      ))}
    </div>
  );
}

function StationGroup({ stationName, orders, onUpdateStatus, onStatusChanged }: {
  stationName: string;
  orders: SupabaseWorkOrder[];
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg bg-card">
      <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 hover:bg-muted/30 transition-colors rounded-t-lg">
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <Cpu className="w-4 h-4 text-primary" />
        <span className="text-sm font-black italic tracking-wide uppercase text-foreground flex-1 text-left truncate">
          {stationName}
        </span>
        <Badge variant="outline" className="text-[10px] tracking-wider shrink-0">
          {orders.length} {orders.length === 1 ? "WO" : "WOs"}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-1.5">
        {orders.map(wo => (
          <WorkOrderRow key={wo.id} wo={wo} onUpdateStatus={onUpdateStatus} onStatusChanged={onStatusChanged} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function WorkOrderRow({ wo, onUpdateStatus, onStatusChanged }: {
  wo: SupabaseWorkOrder;
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
}) {
  const isActive = wo.status === "in_progress";
  const st = statusConfig[wo.status || "pending"] || statusConfig.pending;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      isActive ? "border-success/40 bg-card hover:bg-muted/30" : "border-border bg-card hover:bg-muted/30"
    }`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
      <Badge className={`${st.color} text-[10px] tracking-wider shrink-0`}>{st.label}</Badge>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-foreground truncate">{wo.work_order_number}</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {wo.customer_name && <span>{wo.customer_name}</span>}
          {wo.order_number && <span>• Order {wo.order_number}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isActive ? (
          <>
            <Button variant="outline" size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-warning/40 text-warning hover:bg-warning/10"
              onClick={async () => { const ok = await onUpdateStatus(wo.id, "on_hold"); if (ok) onStatusChanged(wo.work_order_number, "Paused"); }}>
              <Pause className="w-3 h-3" /> Pause
            </Button>
            <Button variant="outline" size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-success/40 text-success hover:bg-success/10"
              onClick={async () => { const ok = await onUpdateStatus(wo.id, "completed"); if (ok) onStatusChanged(wo.work_order_number, "Completed"); }}>
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Button>
          </>
        ) : wo.status !== "completed" ? (
          <Button size="sm" className="h-7 text-[10px] gap-1 px-2.5 font-bold"
            onClick={async () => { const ok = await onUpdateStatus(wo.id, "in_progress"); if (ok) onStatusChanged(wo.work_order_number, "Started"); }}>
            <Play className="w-3 h-3" /> Start
          </Button>
        ) : null}
      </div>
    </div>
  );
}
