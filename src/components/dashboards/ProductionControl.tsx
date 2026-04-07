import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Wrench, AlertTriangle } from "lucide-react";

const PHASES = ["queued", "cutting", "cut_done", "bending", "clearance", "loading", "complete"];

export function ProductionControl() {
  const { companyId } = useCompanyId();

  const { data: items = [] } = useQuery({
    queryKey: ["production-control-items", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_plan_items")
        .select("id, phase, work_order_id, created_at, total_pieces, completed_pieces")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines-dashboard", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, type, status")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const byPhase = useMemo(() => {
    const map: Record<string, number> = {};
    PHASES.forEach((p) => (map[p] = 0));
    items.forEach((i: any) => {
      if (i.phase && map[i.phase] !== undefined) map[i.phase]++;
    });
    return map;
  }, [items]);

  const stuckItems = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600000;
    return items.filter(
      (i: any) => i.phase && !["complete", "clearance"].includes(i.phase) && new Date(i.created_at).getTime() < cutoff
    ).length;
  }, [items]);

  const machineStats = useMemo(() => {
    const running = machines.filter((m: any) => m.status === "running").length;
    const idle = machines.filter((m: any) => m.status !== "running").length;
    return { running, idle, total: machines.length };
  }, [machines]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Wrench className="w-4 h-4" /> Production Control
      </h3>

      {/* WIP by phase */}
      <div className="grid grid-cols-3 gap-2">
        {PHASES.map((p) => (
          <Card key={p}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{byPhase[p]}</p>
              <p className="text-[10px] text-muted-foreground">{p.replace(/_/g, " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Machine utilization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Machine Utilization</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Badge variant="outline" className="bg-green-500/10 text-green-700">
            Running: {machineStats.running}
          </Badge>
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600">
            Idle: {machineStats.idle}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{machineStats.total} total</span>
        </CardContent>
      </Card>

      {/* Stuck orders */}
      {stuckItems > 0 && (
        <Card className="border-amber-300">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">{stuckItems} items stuck &gt; 24h</p>
              <p className="text-xs text-muted-foreground">Items in production for over 24 hours</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
