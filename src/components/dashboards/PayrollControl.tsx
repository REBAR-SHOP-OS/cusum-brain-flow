import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, AlertTriangle, UserCheck } from "lucide-react";

export function PayrollControl() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["payroll-control-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("id, profile_id, clock_in, clock_out, notes, break_minutes")
        .order("clock_in", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const openShifts = useMemo(
    () => entries.filter((e) => !e.clock_out),
    [entries]
  );

  const autoClosed = useMemo(
    () => entries.filter((e) => e.notes?.includes("[auto-closed")),
    [entries]
  );

  const avgHours = useMemo(() => {
    const closed = entries.filter((e) => e.clock_out);
    if (closed.length === 0) return null;
    const total = closed.reduce((s, e) => {
      const dur = (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000;
      return s + Math.max(0, dur - (e.break_minutes || 0) / 60);
    }, 0);
    return (total / closed.length).toFixed(1);
  }, [entries]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" /> Payroll Control
      </h3>

      <div className="grid grid-cols-3 gap-2">
        <Card className={openShifts.length > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${openShifts.length > 0 ? "text-amber-600" : ""}`}>
              {openShifts.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Open Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{autoClosed.length}</p>
            <p className="text-[10px] text-muted-foreground">Auto-Closed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{avgHours ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Avg Hours</p>
          </CardContent>
        </Card>
      </div>

      {openShifts.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Currently Clocked In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {openShifts.slice(0, 10).map((e) => {
              const hours = ((Date.now() - new Date(e.clock_in).getTime()) / 3600000).toFixed(1);
              return (
                <div key={e.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate">
                    {new Date(e.clock_in).toLocaleString()}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${Number(hours) > 10 ? "text-destructive" : ""}`}
                  >
                    {hours}h
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {autoClosed.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Recently Auto-Closed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {autoClosed.slice(0, 5).map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate">
                  {new Date(e.clock_in).toLocaleDateString()}
                </span>
                <Badge variant="outline" className="text-xs">9h default</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground text-sm py-6">No time entries</p>
      )}
    </div>
  );
}
