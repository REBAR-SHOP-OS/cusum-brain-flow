import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { CapacityForecastDay } from "@/hooks/useCEODashboard";

interface Props { open: boolean; onClose: () => void; capacityForecast: CapacityForecastDay[]; }

export function CapacityDrawer({ open, onClose, capacityForecast }: Props) {
  const overloaded = capacityForecast.filter((d) => d.utilization > 100);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border/50 overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10"><Gauge className="w-5 h-5 text-primary" /></div>
            Capacity Forecast (7-Day)
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {overloaded.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠ Overload detected on {overloaded.map((d) => d.day).join(", ")} — consider rescheduling non-urgent jobs.
            </div>
          )}

          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityForecast} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 130]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v}%`, "Utilization"]} />
                <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Bar dataKey="utilization" radius={[6, 6, 0, 0]} barSize={28}>
                  {capacityForecast.map((entry, i) => (
                    <Cell key={i} fill={entry.utilization > 100 ? "hsl(var(--destructive))" : entry.utilization > 80 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Breakdown</h3>
            {capacityForecast.filter((d) => d.capacity > 0).map((d) => (
              <div key={d.day} className="flex items-center justify-between p-2 rounded-lg border border-border/50 text-sm">
                <span className="font-medium">{d.day}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Load: {d.load}%</span>
                  <Badge variant="outline" className={`text-xs ${d.utilization > 100 ? "border-destructive/40 text-destructive" : d.utilization > 80 ? "border-amber-500/40 text-amber-500" : "border-primary/40 text-primary"}`}>
                    {d.utilization}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
