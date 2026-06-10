import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useStaleCompletedWorkOrders } from "@/hooks/useStaleCompletedWorkOrders";
import { startWorkOrder } from "@/lib/workOrderDispatch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/**
 * Visible warning for "stale completed" work orders — WOs whose header is
 * `completed` while their cut_plan_items still have unfinished pieces.
 * One-click Reopen flips the WO back to `in_progress` and re-runs the
 * dispatcher so the manifest returns to the active cutter queue.
 */
export function StaleCompletionAlert() {
  const { data: stale, isLoading } = useStaleCompletedWorkOrders();
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  if (isLoading || !stale || stale.length === 0) return null;

  const handleReopen = async (id: string, label: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "in_progress", actual_end: null })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      const r = await startWorkOrder(id);
      toast({
        title: r.ok ? `Reopened ${label}` : `Reopened ${label} (queue note)`,
        description: r.ok
          ? `Re-dispatched ${r.assigned}/${r.total} task(s) to the cutter.`
          : r.reason || "WO reopened; no dispatch changes were needed.",
      });
      await qc.invalidateQueries({ queryKey: ["stale-completed-work-orders"] });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      await qc.invalidateQueries({ queryKey: ["supabaseWorkOrders"] });
    } catch (e: any) {
      toast({
        title: `Failed to reopen ${label}`,
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-warning/50 bg-warning/5">
        <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-warning" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-warning" />
          )}
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-warning">
            Stale "Completed" Work Orders
          </span>
          <Badge variant="secondary" className="ml-2 text-[10px]">
            {stale.length}
          </Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">
            marked done but pieces still pending
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 pt-1 space-y-1.5">
          {stale.map((wo) => {
            const label = wo.work_order_number;
            return (
              <div
                key={wo.id}
                className="flex items-center gap-3 p-2.5 rounded-md border border-warning/30 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm uppercase truncate">
                    {wo.customer_name || "Unassigned"}
                  </div>
                  <div className="text-[11px] text-primary/90 truncate pl-3">
                    ├─ {wo.order_number || "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate pl-3">
                    └─ {label} · {wo.pending_pieces}/{wo.total_pieces} pieces pending ·{" "}
                    {wo.unfinished_items} unfinished item(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 px-2.5 font-bold border-warning/50 text-warning hover:bg-warning/10"
                  disabled={busyId === wo.id}
                  onClick={() => handleReopen(wo.id, label)}
                >
                  <RotateCcw className="w-3 h-3" />
                  {busyId === wo.id ? "Reopening…" : "Reopen"}
                </Button>
              </div>
            );
          })}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
