import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { manageBend } from "@/lib/manageBendService";
import { Play, Pause, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BenderBatchItem } from "@/hooks/useBenderBatches";

interface BenderBatchPanelProps {
  batches: BenderBatchItem[];
  canWrite: boolean;
  onRefresh?: () => void;
}

const statusColor: Record<string, string> = {
  queued: "bg-muted text-foreground",
  bending: "bg-primary/20 text-primary",
  paused: "bg-amber-500/20 text-amber-600",
};

export function BenderBatchPanel({ batches, canWrite, onRefresh }: BenderBatchPanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: "start-bend" | "pause-bend" | "complete-bend" | "cancel-bend", batchId: string, actualQty?: number) => {
    if (busy) return; // throttle
    setBusy(batchId);
    try {
      await manageBend({ action, bendBatchId: batchId, actualQty });
      toast({ title: action.replace("-", " ").toUpperCase(), description: `Batch updated` });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (batches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        No bend batches assigned to this machine
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Bend Batches ({batches.length})
      </h3>
      {batches.map((b) => {
        const isBusy = busy === b.id;
        return (
          <Card key={b.id} className={cn("border", b.status === "bending" && "border-primary/50 ring-1 ring-primary/20")}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] font-mono", statusColor[b.status] || "bg-muted text-foreground")}>
                    {b.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-bold text-foreground">{b.size || "—"}</span>
                  {b.shape && <span className="text-xs text-muted-foreground">Shape: {b.shape}</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">Planned</p>
                  <p className="text-lg font-bold text-foreground">{b.planned_qty}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">Actual</p>
                  <p className="text-lg font-bold text-primary">{b.actual_qty ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">Variance</p>
                  <p className={cn("text-lg font-bold", (b.variance ?? 0) !== 0 ? "text-destructive" : "text-muted-foreground")}>
                    {b.variance ?? "—"}
                  </p>
                </div>
              </div>

              {b.source_cut_batch_id && (
                <p className="text-[9px] text-muted-foreground truncate">
                  Cut Batch: {b.source_cut_batch_id.slice(0, 8)}…
                </p>
              )}

              {canWrite && (
                <div className="flex gap-2">
                  {b.status === "queued" && (
                    <Button size="sm" className="flex-1 gap-1" disabled={isBusy} onClick={() => act("start-bend", b.id)}>
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      START
                    </Button>
                  )}
                  {b.status === "bending" && (
                    <>
                      <Button size="sm" variant="outline" className="flex-1 gap-1" disabled={isBusy} onClick={() => act("pause-bend", b.id)}>
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                        PAUSE
                      </Button>
                      <Button size="sm" className="flex-1 gap-1" disabled={isBusy} onClick={() => act("complete-bend", b.id)}>
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        COMPLETE
                      </Button>
                    </>
                  )}
                  {b.status === "paused" && (
                    <Button size="sm" className="flex-1 gap-1" disabled={isBusy} onClick={() => act("start-bend", b.id)}>
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      RESUME
                    </Button>
                  )}
                  {["queued", "bending", "paused"].includes(b.status) && (
                    <Button size="sm" variant="destructive" className="gap-1" disabled={isBusy} onClick={() => act("cancel-bend", b.id)}>
                      <XCircle className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
