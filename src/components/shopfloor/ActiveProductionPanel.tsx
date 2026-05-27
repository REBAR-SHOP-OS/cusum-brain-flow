import { useNavigate } from "react-router-dom";
import { Activity, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectLane } from "@/hooks/useProductionQueues";

/**
 * Active production list — currently-running tasks across all machines.
 * Operators / supervisors can glance at what is on the floor in real time.
 */
export function ActiveProductionPanel({ lanes }: { lanes: ProjectLane[] }) {
  const navigate = useNavigate();

  const running = lanes
    .flatMap((l) =>
      l.items
        .filter((i) => i.status === "running")
        .map((i) => ({ ...i, projectName: l.projectName ?? "Unassigned" })),
    )
    .slice(0, 50);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" />
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
              Active Production
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Started shop-floor work
            </p>
          </div>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {running.length} running
        </Badge>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {running.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Nothing running right now.
          </div>
        ) : (
          running.map((item) => {
            const progress =
              item.task && item.task.qty_required
                ? Math.min(
                    100,
                    Math.round(((item.task.qty_completed ?? 0) / item.task.qty_required) * 100),
                  )
                : null;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Activity className="h-3.5 w-3.5 shrink-0 text-info" />
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                      {item.projectName}
                    </span>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30 text-[10px]">
                    running
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.task?.mark_number && <span>mark {item.task.mark_number}</span>}
                  {item.task?.task_type && <span>· {item.task.task_type}</span>}
                  {item.task?.qty_required != null && (
                    <span className="tabular-nums">
                      · {item.task.qty_completed ?? 0}/{item.task.qty_required} pcs
                    </span>
                  )}
                </div>

                {progress != null && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {running.length > 0 && (
        <div className="flex justify-end border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] uppercase tracking-wider"
            onClick={() => navigate("/shopfloor/pool")}
          >
            <Pause className="mr-1 h-3 w-3" /> View pool
          </Button>
        </div>
      )}
    </div>
  );
}
