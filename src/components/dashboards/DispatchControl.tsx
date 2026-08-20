import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Truck, AlertTriangle, CalendarDays } from "lucide-react";

export function DispatchControl() {
  const { companyId } = useCompanyId();

  const { data: deliveries = [] } = useQuery({
    queryKey: ["dispatch-control", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, driver_name, vehicle, scheduled_date, created_at, order_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const staged = useMemo(() => deliveries.filter((d: any) => d.status === "staged").length, [deliveries]);
  
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = useMemo(
    () => deliveries.filter((d: any) => d.scheduled_date && d.scheduled_date.slice(0, 10) === today).length,
    [deliveries, today]
  );

  const late = useMemo(() => {
    return deliveries.filter((d: any) => {
      if (!d.scheduled_date) return false;
      return d.scheduled_date < today && !["delivered", "cancelled"].includes(d.status);
    }).length;
  }, [deliveries, today]);

  const driverWorkload = useMemo(() => {
    const map: Record<string, number> = {};
    deliveries
      .filter((d: any) => d.driver_name && !["delivered", "cancelled"].includes(d.status))
      .forEach((d: any) => {
        map[d.driver_name] = (map[d.driver_name] || 0) + 1;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [deliveries]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Truck className="w-4 h-4" /> Dispatch Control
      </h3>

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{staged}</p>
            <p className="text-[10px] text-muted-foreground">Staged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{scheduledToday}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card className={late > 0 ? "border-red-300" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${late > 0 ? "text-destructive" : ""}`}>{late}</p>
            <p className="text-[10px] text-muted-foreground">Late</p>
          </CardContent>
        </Card>
      </div>

      {/* Driver workload */}
      {driverWorkload.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Driver Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {driverWorkload.map(([name, count]) => (
              <div key={name} className="flex justify-between text-sm">
                <span>{name}</span>
                <Badge variant="outline" className="text-xs">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Missing schedule info */}
      {(() => {
        const incomplete = deliveries.filter(
          (d: any) => !["delivered", "cancelled"].includes(d.status) && (!d.driver_name || !d.vehicle || !d.scheduled_date)
        );
        if (incomplete.length === 0) return null;
        return (
          <Card className="border-amber-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Missing Schedule Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {incomplete.slice(0, 5).map((d: any) => (
                <div key={d.id} className="text-sm flex gap-2">
                  <span className="text-muted-foreground truncate">{d.id.slice(0, 8)}</span>
                  <div className="flex gap-1">
                    {!d.driver_name && <Badge variant="outline" className="text-[10px] text-destructive">no driver</Badge>}
                    {!d.vehicle && <Badge variant="outline" className="text-[10px] text-destructive">no vehicle</Badge>}
                    {!d.scheduled_date && <Badge variant="outline" className="text-[10px] text-destructive">no date</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {deliveries.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-6">No deliveries</p>
      )}
    </div>
  );
}
