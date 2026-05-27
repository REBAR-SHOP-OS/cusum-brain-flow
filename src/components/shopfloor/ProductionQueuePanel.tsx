import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Workflow, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectLane } from "@/hooks/useProductionQueues";

/**
 * Approved Office work → Shop-floor handoff queue.
 * Lists project lanes with item counts. Click → opens cutter queue for that lane.
 * If `children` is provided, renders it in place of the lane list (used to embed
 * Work Order Queue inside this box).
 */
export function ProductionQueuePanel({ lanes, children }: { lanes: ProjectLane[]; children?: ReactNode }) {
  const navigate = useNavigate();
  const total = lanes.reduce((s, l) => s + l.items.length, 0);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
              Production Queue
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Approved Office work → shop floor handoff
            </p>
          </div>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {lanes.length} project{lanes.length !== 1 ? "s" : ""} · {total} task
          {total !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {lanes.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No work approved for the floor yet.
          </div>
        ) : (
          lanes.map((lane) => (
            <button
              key={lane.projectId ?? "unassigned"}
              onClick={() => navigate("/shopfloor/cutter")}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                  {lane.projectName ?? "Unassigned customer"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {lane.items.length} task{lane.items.length !== 1 ? "s" : ""}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>

      {lanes.length > 0 && (
        <div className="flex justify-end border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] uppercase tracking-wider"
            onClick={() => navigate("/shopfloor/cutter")}
          >
            Open cutter plan
          </Button>
        </div>
      )}
    </div>
  );
}
