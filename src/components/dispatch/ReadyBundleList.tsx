import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Package, ChevronRight, ShieldCheck } from "lucide-react";
import type { CompletedBundle } from "@/hooks/useCompletedBundles";

interface ReadyBundleListProps {
  bundles: CompletedBundle[];
  title: string;
  onSelect?: (bundle: CompletedBundle) => void;
}

export const ReadyBundleList = forwardRef<HTMLDivElement, ReadyBundleListProps>(
  function ReadyBundleList({ bundles, title, onSelect }, ref) {
    if (bundles.length === 0) return null;

    const formatStatus = (status: string | null) =>
      status ? status.replace(/_/g, " ").toUpperCase() : "PENDING";

    return (
      <div ref={ref} className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-primary">
            {title}
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {bundles.length}
          </Badge>
        </div>
        {bundles.map((bundle) => (
          <button
            key={bundle.cutPlanId}
            onClick={() => onSelect?.(bundle)}
            className="w-full rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Package className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <span className="font-bold text-sm tracking-wide uppercase text-foreground block truncate">
                  {bundle.customerName || "Unassigned"}
                </span>
                <span className="text-[11px] text-primary/90 block truncate pl-3">
                  ├─ {bundle.projectDisplayName || bundle.projectName || "Unassigned"}
                </span>
                <div className="flex items-center gap-1.5 min-w-0 pl-3">
                  <span className="text-[10px] text-muted-foreground truncate">
                    └─ {bundle.planName || "Unassigned Barlist"}
                  </span>
                  {typeof bundle.barlistRevisionNo === "number" && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      R{bundle.barlistRevisionNo}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                    {formatStatus(bundle.barlistStatus || bundle.cutPlanStatus)}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground block pl-3">
                  {bundle.items.length} items • {bundle.totalPieces} pcs
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="default" className="text-[10px]">
                Ready
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    );
  }
);
