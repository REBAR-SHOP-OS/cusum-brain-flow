import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";

type DateRange = "1d" | "7d" | "30d";

export default function ProductionAudit() {
  const { companyId } = useCompanyId();
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [eventFilter, setEventFilter] = useState("all");

  const since = subDays(new Date(), dateRange === "1d" ? 1 : dateRange === "7d" ? 7 : 30).toISOString();

  // Machines with lock state
  const { data: machines = [], isLoading: machinesLoading, refetch: refetchMachines } = useQuery({
    queryKey: ["audit-machines", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, status, machine_lock, cut_session_status, active_job_id, active_plan_id, current_run_id")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Cut batches summary
  const { data: cutBatches = [] } = useQuery({
    queryKey: ["audit-cut-batches", companyId, since],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_batches")
        .select("id, status, planned_qty, actual_qty, bar_code, created_at")
        .eq("company_id", companyId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Bend batches summary
  const { data: bendBatches = [] } = useQuery({
    queryKey: ["audit-bend-batches", companyId, since],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bend_batches" as any)
        .select("id, status, planned_qty, actual_qty, variance, size, shape, created_at")
        .eq("company_id", companyId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Bundles summary
  const { data: bundles = [] } = useQuery({
    queryKey: ["audit-bundles", companyId, since],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles" as any)
        .select("id, status, quantity, size, shape, bundle_code, created_at")
        .eq("company_id", companyId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Waste bank summary
  const { data: wastePieces = [] } = useQuery({
    queryKey: ["audit-waste", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_bank_pieces")
        .select("id, status, bar_code, length_mm")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Deliveries summary
  const { data: deliveries = [] } = useQuery({
    queryKey: ["audit-deliveries", companyId, since],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, delivery_number, created_at")
        .eq("company_id", companyId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Production events timeline
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["audit-events", companyId, since, eventFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("production_events")
        .select("id, event_type, metadata, created_at, machine_id, triggered_by")
        .eq("company_id", companyId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (eventFilter !== "all") {
        q = q.eq("event_type", eventFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const wasteAvail = wastePieces.filter(w => w.status === "available").length;
  const wasteReserved = wastePieces.filter(w => w.status === "reserved").length;
  const wasteConsumed = wastePieces.filter(w => w.status === "consumed").length;

  const countByStatus = (arr: any[]) => {
    const m: Record<string, number> = {};
    arr.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  };

  const cutStats = countByStatus(cutBatches);
  const bendStats = countByStatus(bendBatches);
  const bundleStats = countByStatus(bundles);
  const delStats = countByStatus(deliveries);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wide text-foreground">Production Audit</h1>
          <p className="text-[9px] tracking-[0.2em] uppercase text-primary">Supervisor Traceability Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">24h</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetchMachines()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-6">
          {/* Machine Lock State */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Machine Lock State</CardTitle></CardHeader>
            <CardContent>
              {machinesLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {machines.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                      <span className="font-bold">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.machine_lock ? "destructive" : "outline"} className="text-[9px]">
                          {m.machine_lock ? "LOCKED" : "FREE"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{m.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard title="Cut Batches" stats={cutStats} total={cutBatches.length} />
            <SummaryCard title="Bend Batches" stats={bendStats} total={bendBatches.length} />
            <SummaryCard title="Bundles" stats={bundleStats} total={bundles.length} />
            <SummaryCard title="Deliveries" stats={delStats} total={deliveries.length} />
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Waste Bank</p>
                <div className="text-xs space-y-0.5">
                  <p><span className="font-bold text-foreground">{wasteAvail}</span> available</p>
                  <p><span className="font-bold text-amber-500">{wasteReserved}</span> reserved</p>
                  <p><span className="font-bold text-muted-foreground">{wasteConsumed}</span> consumed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Production Events Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Production Events</CardTitle>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="cutter_started">Cutter Started</SelectItem>
                    <SelectItem value="cutter_completed">Cutter Completed</SelectItem>
                    <SelectItem value="bender_started">Bender Started</SelectItem>
                    <SelectItem value="bender_completed">Bender Completed</SelectItem>
                    <SelectItem value="bundle_created">Bundle Created</SelectItem>
                    <SelectItem value="delivery_created">Delivery Created</SelectItem>
                    <SelectItem value="variance_detected">Variance</SelectItem>
                    <SelectItem value="supervisor_override">Supervisor Override</SelectItem>
                    <SelectItem value="capability_violation">Capability Violation</SelectItem>
                    <SelectItem value="machine_size_routing_blocked">Routing Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {eventsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No events in range</p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-auto">
                  {events.map(e => (
                    <div key={e.id} className="flex items-start gap-2 text-xs border-b border-border pb-1.5">
                      <span className="text-muted-foreground whitespace-nowrap font-mono">
                        {format(new Date(e.created_at), "MMM dd HH:mm")}
                      </span>
                      <Badge variant="outline" className="text-[8px] shrink-0">{e.event_type}</Badge>
                      <span className="text-foreground truncate">
                        {typeof e.metadata === "object" && e.metadata
                          ? JSON.stringify(e.metadata).slice(0, 120)
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryCard({ title, stats, total }: { title: string; stats: Record<string, number>; total: number }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-[9px] text-muted-foreground uppercase mb-1">{title}</p>
        <p className="text-2xl font-black text-foreground">{total}</p>
        <div className="text-[9px] text-muted-foreground mt-1">
          {Object.entries(stats).map(([k, v]) => (
            <span key={k} className="mr-2">{k}: {v}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
