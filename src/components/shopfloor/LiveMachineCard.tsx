import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scissors,
  RotateCcw,
  Package,
  Wrench,
  Play,
  Pause,
  Square,
  AlertTriangle,
  User,
  Clock,
  CheckCircle2,
  ListOrdered,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LiveMachine, MachineStatus, QueuedRun } from "@/types/machine";

interface LiveMachineCardProps {
  machine: LiveMachine;
  canWrite: boolean;
  operators: { id: string; full_name: string }[];
  onAction: (
    machineId: string,
    action: string,
    params?: Record<string, unknown>
  ) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  cutter: Scissors,
  bender: RotateCcw,
  loader: Package,
  other: Wrench,
};

const statusConfig: Record<
  MachineStatus,
  { label: string; className: string }
> = {
  idle: {
    label: "Idle",
    className: "bg-muted text-muted-foreground",
  },
  running: {
    label: "Running",
    className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  },
  blocked: {
    label: "Blocked",
    className: "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
  },
  down: {
    label: "Down",
    className: "bg-destructive/15 text-destructive",
  },
};

/** Parse bar_code from cut plan notes like "cut_plan_id:xxx | 25M x4 @ 3000mm" */
function parseBarCodeFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\b(\d{1,2}M)\b/);
  return match ? match[1] : null;
}

/** Parse input_qty from notes or run */
function parseQtyFromNotes(notes: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/x(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function LiveMachineCard({
  machine,
  canWrite,
  operators,
  onAction,
}: LiveMachineCardProps) {
  const [showStartRun, setShowStartRun] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState("cut");

  const TypeIcon = typeIcons[machine.type] || Wrench;
  const status = statusConfig[machine.status] || statusConfig.idle;
  const hasActiveRun = !!machine.current_run_id;
  const queuedRuns = machine.queued_runs || [];
  const hasQueuedRuns = queuedRuns.length > 0;

  const handleStartRun = () => {
    onAction(machine.id, "start-run", { process: selectedProcess });
    setShowStartRun(false);
  };

  const handleStartQueuedRun = (run: QueuedRun) => {
    const barCode = parseBarCodeFromNotes(run.notes);
    const qty = run.input_qty || parseQtyFromNotes(run.notes);
    onAction(machine.id, "start-queued-run", {
      runId: run.id,
      ...(barCode ? { barCode } : {}),
      ...(qty ? { qty } : {}),
    });
  };

  const handleCompleteRun = () => {
    onAction(machine.id, "complete-run");
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Status bar accent */}
      <div
        className={`absolute top-0 left-0 w-1 h-full ${
          machine.status === "running"
            ? "bg-[hsl(var(--success))]"
            : machine.status === "blocked"
            ? "bg-[hsl(var(--warning))]"
            : machine.status === "down"
            ? "bg-destructive"
            : "bg-muted-foreground/30"
        }`}
      />

      <CardHeader className="pb-2 pl-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-muted-foreground" />
            {machine.name}
          </CardTitle>
          <Badge className={status.className}>{status.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground capitalize">
          {machine.type}
          {machine.model && <span className="ml-1">• {machine.model}</span>}
        </p>
      </CardHeader>

      <CardContent className="pl-5 space-y-3">
        {/* Operator */}
        <div className="flex items-center gap-2 text-sm">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          {canWrite ? (
            <Select
              value={machine.current_operator_profile_id || "none"}
              onValueChange={(val) =>
                onAction(machine.id, "assign-operator", {
                  operatorProfileId: val === "none" ? null : val,
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <SelectValue placeholder="Assign operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">
              {machine.operator?.full_name || "Unassigned"}
            </span>
          )}
        </div>

        {/* Current Run */}
        {machine.current_run && (
          <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">
                {machine.current_run.process} →{" "}
                {machine.current_run.status}
              </span>
            </div>
            {machine.current_run.notes && (
              <p className="text-muted-foreground truncate">
                {machine.current_run.notes}
              </p>
            )}
            {machine.current_run.started_at && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Started{" "}
                {formatDistanceToNow(
                  new Date(machine.current_run.started_at),
                  { addSuffix: true }
                )}
              </div>
            )}
          </div>
        )}

        {/* Queued Runs (visible to all, actionable only for canWrite) */}
        {hasQueuedRuns && !hasActiveRun && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListOrdered className="w-3.5 h-3.5" />
              {queuedRuns.length} queued run{queuedRuns.length !== 1 ? "s" : ""}
            </div>
            {queuedRuns.slice(0, 3).map((run) => {
              const barCode = parseBarCodeFromNotes(run.notes);
              return (
                <div
                  key={run.id}
                  className="rounded-md border border-border bg-muted/30 p-2 text-xs flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{run.process}</span>
                    {barCode && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] font-mono">
                        {barCode}
                      </Badge>
                    )}
                    {run.input_qty && (
                      <span className="text-muted-foreground ml-1">×{run.input_qty}</span>
                    )}
                    {run.notes && (
                      <p className="text-muted-foreground truncate mt-0.5">{run.notes}</p>
                    )}
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      className="h-6 text-[11px] gap-1 shrink-0"
                      onClick={() => handleStartQueuedRun(run)}
                    >
                      <Play className="w-3 h-3" /> Start
                    </Button>
                  )}
                </div>
              );
            })}
            {queuedRuns.length > 3 && (
              <p className="text-[11px] text-muted-foreground">
                +{queuedRuns.length - 3} more queued
              </p>
            )}
          </div>
        )}

        {/* Last event */}
        {machine.last_event_at && (
          <p className="text-xs text-muted-foreground">
            Last event:{" "}
            {formatDistanceToNow(new Date(machine.last_event_at), {
              addSuffix: true,
            })}
          </p>
        )}

        {/* Controls — hidden for office */}
        {canWrite && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            {!hasActiveRun && !showStartRun && !hasQueuedRuns && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowStartRun(true)}
                >
                  <Play className="w-3 h-3" /> Start Run
                </Button>
                <Select
                  value={machine.status}
                  onValueChange={(val) =>
                    onAction(machine.id, "update-status", { status: val })
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="down">Down</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            {!hasActiveRun && !showStartRun && hasQueuedRuns && (
              <Select
                value={machine.status}
                onValueChange={(val) =>
                  onAction(machine.id, "update-status", { status: val })
                }
              >
                <SelectTrigger className="h-7 text-xs w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                </SelectContent>
              </Select>
            )}

            {showStartRun && !hasActiveRun && (
              <div className="flex items-center gap-2 w-full">
                <Select
                  value={selectedProcess}
                  onValueChange={setSelectedProcess}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "cut",
                      "bend",
                      "load",
                      "pickup",
                      "delivery",
                      "clearance",
                      "other",
                    ].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleStartRun}
                >
                  <Play className="w-3 h-3" /> Go
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowStartRun(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {hasActiveRun && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onAction(machine.id, "pause-run")}
                >
                  <Pause className="w-3 h-3" /> Pause
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-[hsl(var(--warning))]"
                  onClick={() => onAction(machine.id, "block-run")}
                >
                  <AlertTriangle className="w-3 h-3" /> Block
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  onClick={handleCompleteRun}
                >
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

LiveMachineCard.displayName = "LiveMachineCard";
