import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInHours, differenceInMinutes, format } from "date-fns";

interface SLAItem {
  id: string;
  title: string;
  stage: string;
  deadline: string;
  hoursLeft: number;
  status: "on_track" | "warning" | "breached";
  entityType: "lead" | "order";
}

export function SLATrackerCard() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sla-tracker"],
    queryFn: async () => {
      const now = new Date();
      const result: SLAItem[] = [];

      // Leads with active SLA deadlines
      const { data: leads } = await supabase
        .from("leads")
        .select("id, title, stage, sla_deadline, sla_breached")
        .not("sla_deadline", "is", null)
        .not("stage", "in", "(won,lost,archived_orphan)")
        .order("sla_deadline", { ascending: true })
        .limit(20);

      if (leads) {
        for (const lead of leads) {
          const deadline = new Date(lead.sla_deadline!);
          const hoursLeft = differenceInHours(deadline, now);
          const status: SLAItem["status"] = lead.sla_breached
            ? "breached"
            : hoursLeft < 2
            ? "warning"
            : "on_track";

          result.push({
            id: lead.id,
            title: lead.title || "Untitled Lead",
            stage: lead.stage || "unknown",
            deadline: lead.sla_deadline!,
            hoursLeft,
            status,
            entityType: "lead",
          });
        }
      }

      // Orders with production_locked or qc_evidence pending
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, production_locked, qc_evidence_uploaded, updated_at")
        .or("production_locked.eq.true,qc_evidence_uploaded.eq.false")
        .in("status", ["confirmed", "in_production"])
        .order("updated_at", { ascending: true })
        .limit(10);

      if (orders) {
        for (const order of orders) {
          const updatedAt = new Date(order.updated_at);
          const hoursStuck = differenceInHours(now, updatedAt);
          const slaLimit = order.production_locked ? 12 : 4;
          const hoursLeft = slaLimit - hoursStuck;
          const status: SLAItem["status"] = hoursLeft <= 0
            ? "breached"
            : hoursLeft < 2
            ? "warning"
            : "on_track";

          result.push({
            id: order.id,
            title: order.order_number,
            stage: order.production_locked ? "production_blocked" : "qc_evidence_pending",
            deadline: new Date(updatedAt.getTime() + slaLimit * 3600000).toISOString(),
            hoursLeft,
            status,
            entityType: "order",
          });
        }
      }

      // Sort: breached first, then warning, then by hours left
      return result.sort((a, b) => {
        const statusOrder = { breached: 0, warning: 1, on_track: 2 };
        const diff = statusOrder[a.status] - statusOrder[b.status];
        if (diff !== 0) return diff;
        return a.hoursLeft - b.hoursLeft;
      });
    },
    refetchInterval: 60000,
  });

  const breachedCount = items.filter((i) => i.status === "breached").length;
  const warningCount = items.filter((i) => i.status === "warning").length;

  if (isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-500" />
            SLA Tracker
          </h2>
          <div className="flex gap-1.5">
            {breachedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {breachedCount} breached
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10">
                {warningCount} at risk
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={`${item.entityType}-${item.id}`}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border text-sm transition-colors",
                item.status === "breached" && "border-destructive/30 bg-destructive/5",
                item.status === "warning" && "border-amber-500/30 bg-amber-500/5",
                item.status === "on_track" && "border-border/50 bg-muted/10"
              )}
            >
              {item.status === "breached" ? (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              ) : (
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    item.status === "warning" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  )}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.stage.replace(/_/g, " ")} · {item.entityType}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums whitespace-nowrap",
                  item.status === "breached" && "text-destructive font-bold",
                  item.status === "warning" && "text-amber-600 font-bold",
                  item.status === "on_track" && "text-muted-foreground"
                )}
              >
                {item.hoursLeft <= 0
                  ? `${Math.abs(item.hoursLeft)}h over`
                  : item.hoursLeft < 1
                  ? `${differenceInMinutes(new Date(item.deadline), new Date())}m left`
                  : `${item.hoursLeft}h left`}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
