import { useCutPlans, useCutPlanItems } from "@/hooks/useCutPlans";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function DetailedListView() {
  const { plans, loading: plansLoading } = useCutPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { items, loading: itemsLoading } = useCutPlanItems(selectedPlanId);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // Separate plans into active (running/draft/ready/queued) and completed
  const { activePlans, completedPlans } = useMemo(() => {
    const active: typeof plans = [];
    const completed: typeof plans = [];
    for (const plan of plans) {
      if (plan.status === "completed") {
        completed.push(plan);
      } else {
        active.push(plan);
      }
    }
    return { activePlans: active, completedPlans: completed };
  }, [plans]);

  // Group plans by customer_name, sorted alphabetically
  const groupByCustomer = (list: typeof plans) => {
    const groups: Record<string, typeof plans> = {};
    for (const plan of list) {
      const key = plan.customer_name || "Ungrouped";
      if (!groups[key]) groups[key] = [];
      groups[key].push(plan);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1;
      if (b === "Ungrouped") return -1;
      return a.localeCompare(b);
    });
  };

  const activeGrouped = useMemo(() => groupByCustomer(activePlans), [activePlans]);
  const completedGrouped = useMemo(() => groupByCustomer(completedPlans), [completedPlans]);

  // Dimension columns
  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"];

  if (!selectedPlanId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-black italic text-foreground uppercase">Detailed List</h1>
        <p className="text-sm text-muted-foreground">Select a manifest to view its detailed item list.</p>
        {plansLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manifests found.</p>
        ) : (
          <div className="space-y-6">
            {/* Active / Running section */}
            {activePlans.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
                  Active ({activePlans.length})
                </h2>
                {renderPlanGroups(activeGrouped)}
              </div>
            )}

            {/* Completed section */}
            {completedPlans.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Completed ({completedPlans.length})
                </h2>
                {renderPlanGroups(completedGrouped)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderPlanGroups(groups: [string, typeof plans][]) {
    return groups.map(([companyName, companyPlans]) => (
      <Collapsible key={companyName} defaultOpen>
        <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group">
          <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=closed]:hidden" />
          <ChevronRight className="w-4 h-4 text-muted-foreground group-data-[state=open]:hidden" />
          <span className="font-bold text-foreground uppercase text-sm tracking-wide">{companyName}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {companyPlans.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l-2 border-border/50 space-y-1 mt-1">
            {companyPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className="w-full text-left pl-4 pr-3 py-2.5 rounded-r-lg hover:bg-muted/30 transition-colors flex items-center justify-between"
              >
                <span className="font-medium text-sm text-foreground">{plan.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{plan.status}</span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    ));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black italic text-foreground uppercase">
            {selectedPlan?.name || "Manifest"}
          </h1>
          <span className="text-xs text-primary/70 tracking-widest uppercase">
            Editing {items.length} Items
          </span>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedPlanId(null)}>
          <ArrowLeft className="w-4 h-4" />
          Back to Queue
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Table header */}
          <div className="grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_40px] gap-0 px-4 py-2 bg-primary/10 border-b border-border text-[10px] font-bold tracking-widest text-primary uppercase sticky top-0">
            <span>DWG #</span>
            <span>Item</span>
            <span>Grade</span>
            <span>Mark</span>
            <span>Qty</span>
            <span>Size</span>
            <span>Type</span>
            <span>Length</span>
            {dimCols.map(c => <span key={c}>{c}</span>)}
            <span>Actions</span>
          </div>

          {/* Rows */}
          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No items in this manifest.</div>
          ) : (
            items.map((item, idx) => {
              const dims = item.bend_dimensions || {};
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_40px] gap-0 px-4 py-2.5 border-b border-border/50 hover:bg-muted/30 text-sm items-center"
                >
                  <span className="text-xs text-muted-foreground">{item.drawing_ref || "—"}</span>
                  <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  <span className="text-xs text-muted-foreground">400W</span>
                  <span className="text-xs font-bold text-primary">{item.mark_number || item.id.slice(0, 5)}</span>
                  <span className="text-xs font-medium">{item.total_pieces}</span>
                  <span className="text-xs">{item.bar_code}</span>
                  <span>
                    {item.bend_type === "bend" ? (
                      <Badge className="bg-orange-500/20 text-orange-400 text-[9px] px-1">
                        {item.asa_shape_code || "BEND"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="text-xs font-bold">{item.cut_length_mm}</span>
                  {dimCols.map(c => (
                    <span key={c} className="text-xs text-muted-foreground">
                      {dims[c] ? <span className="text-foreground">{dims[c]}<sub className="text-[8px] text-muted-foreground ml-0.5">MM</sub></span> : ""}
                    </span>
                  ))}
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
