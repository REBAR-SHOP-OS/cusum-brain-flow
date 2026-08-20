import { CutPlan } from "@/hooks/useCutPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-yellow-500/20 text-yellow-500",
  running: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  canceled: "bg-destructive/20 text-destructive",
};

interface CutPlansListProps {
  plans: CutPlan[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (plan: CutPlan) => void;
  onCreateNew: () => void;
  canWrite: boolean;
}

export function CutPlansList({ plans, loading, selectedId, onSelect, onCreateNew, canWrite }: CutPlansListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading plans…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Cut Plans</h2>
        {canWrite && (
          <Button size="sm" variant="outline" className="gap-1" onClick={onCreateNew}>
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {plans.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No cut plans yet.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => onSelect(plan)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3",
                  selectedId === plan.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{plan.name}</span>
                    <Badge className={cn("text-[10px]", statusColors[plan.status] || statusColors.draft)}>
                      {plan.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
