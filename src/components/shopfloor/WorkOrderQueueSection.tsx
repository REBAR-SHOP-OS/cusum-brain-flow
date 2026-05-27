import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Play, Pause, CheckCircle2, Users } from "lucide-react";
import { SupabaseWorkOrder } from "@/hooks/useSupabaseWorkOrders";

interface WorkOrderQueueSectionProps {
  workOrders: SupabaseWorkOrder[];
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStart?: (id: string) => Promise<{ ok: boolean; assigned: number; total: number; reason?: string }>;
  onPause?: (id: string) => Promise<{ ok: boolean; assigned: number; total: number; reason?: string }>;
  onStatusChanged: (name: string, action: string) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "READY", color: "bg-primary/20 text-primary" },
  queued: { label: "QUEUED", color: "bg-secondary/20 text-secondary" },
  in_progress: { label: "ACTIVE", color: "bg-success/20 text-success" },
  on_hold: { label: "ON HOLD", color: "bg-warning/20 text-warning" },
  completed: { label: "DONE", color: "bg-primary/20 text-primary" },
};

const EXPAND_KEY = "woq:expanded:v1";

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPAND_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function WorkOrderQueueSection({ workOrders, onUpdateStatus, onStart, onPause, onStatusChanged }: WorkOrderQueueSectionProps) {
  const activeOrders = useMemo(() =>
    workOrders.filter(wo => wo.status === "in_progress" || wo.status === "on_hold" || wo.status === "pending" || wo.status === "queued"),
    [workOrders]
  );

  const groups = useMemo(() => {
    const map = new Map<string, SupabaseWorkOrder[]>();
    // activeOrders already arrive newest-first from the hook; preserve that insertion order
    for (const wo of activeOrders) {
      const key = wo.customer_name || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(wo);
    }
    // Sort customer groups by their newest WO's created_at desc; Unassigned last
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Unassigned") return 1;
      if (b[0] === "Unassigned") return -1;
      const aNewest = Math.max(...a[1].map(w => new Date((w as any).created_at || (w as any).actual_start || 0).getTime()));
      const bNewest = Math.max(...b[1].map(w => new Date((w as any).created_at || (w as any).actual_start || 0).getTime()));
      return bNewest - aNewest;
    });
  }, [activeOrders]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => loadExpanded());

  // Prune stale keys when group set changes; persist on every change
  useEffect(() => {
    const names = new Set(groups.map(([n]) => n));
    setExpanded(prev => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) if (names.has(k)) next[k] = prev[k];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.map(([n]) => n).join("|")]);

  useEffect(() => {
    try { localStorage.setItem(EXPAND_KEY, JSON.stringify(expanded)); } catch {}
  }, [expanded]);

  const setOpenFor = (key: string, open: boolean) =>
    setExpanded(prev => ({ ...prev, [key]: open }));

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Order Queue</h2>
      {activeOrders.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">No production-ready work orders.</p>
          <p className="text-xs text-muted-foreground mt-1">Active jobs appear in the Production Queue above.</p>
        </div>
      ) : (
        groups.map(([station, orders]) => (
          <StationGroup
            key={station}
            stationName={station}
            orders={orders}
            open={!!expanded[station]}
            onOpenChange={(o) => setOpenFor(station, o)}
            onUpdateStatus={onUpdateStatus}
            onStatusChanged={onStatusChanged}
          />
        ))
      )}
    </div>
  );
}


function StationGroup({ stationName, orders, open, onOpenChange, onUpdateStatus, onStatusChanged }: {
  stationName: string;
  orders: SupabaseWorkOrder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>

      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Users className="w-3.5 h-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-base font-bold uppercase tracking-wider text-white truncate">
            {stationName}
          </span>
          {(() => {
            const projects = [...new Set(orders.map(o => o.order_number).filter(Boolean))] as string[];
            if (projects.length === 0) return null;
            return (
              <span className="text-[10px] font-bold tracking-wide uppercase text-primary truncate">
                {projects.join(" · ")}
              </span>
            );
          })()}
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {orders.length} {orders.length === 1 ? "WO" : "WOs"}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5 pt-1 space-y-1.5">
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
      <div className="flex-1 min-w-0 space-y-0.5">
        <span className="font-bold text-sm tracking-wide uppercase text-foreground block truncate">
          {wo.customer_name || "Unassigned"}
        </span>
        {wo.order_number && (
          <span className="text-[11px] text-primary/90 block truncate pl-3">
            ├─ {wo.order_number}
          </span>
        )}
        <div className="flex items-center gap-1.5 min-w-0 pl-3">
          <span className="text-[10px] text-muted-foreground truncate">
            └─ {wo.work_order_number}
          </span>
          <Badge className={`${st.color} text-[9px] px-1.5 py-0 tracking-wider shrink-0`}>{st.label}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isActive ? (
          <>
            <Button variant="outline" size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-warning/40 text-warning hover:bg-warning/10"
              onClick={async () => { const ok = await onUpdateStatus(wo.id, "on_hold"); if (ok) onStatusChanged(wo.work_order_number, "Paused"); else onStatusChanged(wo.work_order_number, "Failed to pause — check permissions"); }}>
              <Pause className="w-3 h-3" /> Pause
            </Button>
            <Button variant="outline" size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-success/40 text-success hover:bg-success/10"
              onClick={async () => { const ok = await onUpdateStatus(wo.id, "completed"); if (ok) onStatusChanged(wo.work_order_number, "Completed"); else onStatusChanged(wo.work_order_number, "Failed to complete — check permissions"); }}>
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Button>
          </>
        ) : wo.status !== "completed" ? (
          <Button size="sm" className="h-7 text-[10px] gap-1 px-2.5 font-bold"
            onClick={async () => { const ok = await onUpdateStatus(wo.id, "in_progress"); if (ok) onStatusChanged(wo.work_order_number, "Started"); else onStatusChanged(wo.work_order_number, "Failed to start — check permissions"); }}>
            <Play className="w-3 h-3" /> Start
          </Button>
        ) : null}
      </div>
    </div>
  );
}
