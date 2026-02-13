import { Lock, Unlock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  productionLocked: boolean;
  pendingChangeOrder: boolean;
  shopDrawingStatus: string;
  qcInternalApproved: boolean;
  revisionCount: number;
  billableRequired: boolean;
}

export function ProductionLockBanner({
  productionLocked,
  pendingChangeOrder,
  shopDrawingStatus,
  qcInternalApproved,
  revisionCount,
  billableRequired,
}: Props) {
  const reasons: string[] = [];
  if (shopDrawingStatus !== "approved") reasons.push("Shop drawing not approved");
  if (!qcInternalApproved) reasons.push("QC internal approval missing");
  if (pendingChangeOrder) reasons.push("Pending change order");

  return (
    <div className="space-y-2">
      {/* Production Lock Status */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl border text-sm",
          productionLocked
            ? "border-destructive/30 bg-destructive/5"
            : "border-emerald-500/30 bg-emerald-500/5"
        )}
      >
        {productionLocked ? (
          <Lock className="w-5 h-5 text-destructive shrink-0" />
        ) : (
          <Unlock className="w-5 h-5 text-emerald-500 shrink-0" />
        )}
        <div className="flex-1">
          <p className="font-semibold">
            {productionLocked ? "Production Locked" : "Production Unlocked"}
          </p>
          {productionLocked && reasons.length > 0 && (
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Change Order Banner */}
      {pendingChangeOrder && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Change Order Required
            </p>
            <p className="text-xs text-muted-foreground">
              This order has billable revisions. A Change Order must be processed before continuing.
            </p>
          </div>
        </div>
      )}

      {/* Revision Counter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Revisions:</span>
        <Badge
          variant={revisionCount >= 1 ? "destructive" : "secondary"}
          className="text-xs"
        >
          {revisionCount}
        </Badge>
        {billableRequired && (
          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10">
            Billable
          </Badge>
        )}
      </div>
    </div>
  );
}
