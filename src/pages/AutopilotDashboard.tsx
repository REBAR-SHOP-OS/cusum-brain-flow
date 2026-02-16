import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play, Pause, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, RotateCcw, Loader2, Bot, Shield,
  Zap, Eye, FileCode, ArrowRight, Rocket, Lock, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

const PHASE_STEPS = [
  { key: "context_capture", label: "Context", icon: Eye },
  { key: "planning", label: "Plan", icon: FileCode },
  { key: "simulation", label: "Simulate", icon: Zap },
  { key: "approval", label: "Approve", icon: Shield },
  { key: "execution", label: "Execute", icon: Play },
  { key: "observation", label: "Observe", icon: Eye },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  awaiting_approval: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  executing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-600/20 text-green-500 border-green-600/30",
  failed: "bg-destructive/20 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  rolled_back: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-500",
  medium: "bg-amber-500/20 text-amber-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-destructive/20 text-destructive",
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  approved: "text-green-500",
  rejected: "text-destructive",
  executing: "text-blue-400",
  completed: "text-green-500",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
  rolled_back: "text-orange-400",
};

interface AutopilotAction {
  id: string;
  run_id: string;
  step_order: number;
  tool_name: string;
  tool_params: Record<string, unknown>;
  risk_level: string;
  status: string;
  requires_approval: boolean;
  result: Record<string, unknown> | null;
  error_message: string | null;
  rollback_metadata: Record<string, unknown>;
  rollback_executed: boolean;
  executed_at: string | null;
  created_at: string;
}

interface AutopilotRun {
  id: string;
  title: string;
  description: string;
  trigger_type: string;
  phase: string;
  status: string;
  context_snapshot: Record<string, unknown>;
  plan: unknown[];
  simulation_result: Record<string, unknown>;
  approval_note: string | null;
  error_log: unknown[];
  metrics: Record<string, unknown>;
  execution_lock_uuid: string | null;
  execution_started_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Edge function caller ──
async function callAutopilotEngine(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/autopilot-engine`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...payload }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AutopilotDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["autopilot-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_runs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as AutopilotRun[];
    },
    refetchInterval: 10000,
  });

  const { data: actionsMap = {} } = useQuery({
    queryKey: ["autopilot-actions", expandedRun],
    queryFn: async () => {
      if (!expandedRun) return {};
      const { data, error } = await supabase
        .from("autopilot_actions" as any)
        .select("*")
        .eq("run_id", expandedRun)
        .order("step_order", { ascending: true });
      if (error) throw error;
      return { [expandedRun]: (data || []) as unknown as AutopilotAction[] };
    },
    enabled: !!expandedRun,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] });
    queryClient.invalidateQueries({ queryKey: ["autopilot-actions"] });
  };

  const approveRun = useMutation({
    mutationFn: (runId: string) => callAutopilotEngine("approve_run", { run_id: runId }),
    onSuccess: () => { invalidateAll(); toast.success("Run approved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectRun = useMutation({
    mutationFn: (runId: string) => callAutopilotEngine("reject_run", { run_id: runId }),
    onSuccess: () => { invalidateAll(); toast.success("Run rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAction = useMutation({
    mutationFn: (actionId: string) => callAutopilotEngine("approve_action", { action_id: actionId }),
    onSuccess: () => { invalidateAll(); toast.success("Action approved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectAction = useMutation({
    mutationFn: (actionId: string) => callAutopilotEngine("reject_action", { action_id: actionId }),
    onSuccess: () => { invalidateAll(); toast.success("Action rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const executeRun = useMutation({
    mutationFn: (runId: string) => callAutopilotEngine("execute_run", { run_id: runId }),
    onSuccess: (data) => {
      invalidateAll();
      const m = data.metrics;
      toast.success(`Run executed: ${m.executed_actions} done, ${m.failed_actions} failed (${m.duration_ms}ms)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getPhaseIndex = (phase: string) => PHASE_STEPS.findIndex((p) => p.key === phase);

  const activeRuns = runs.filter((r) => !["completed", "failed", "cancelled", "rolled_back"].includes(r.status));
  const completedRuns = runs.filter((r) => ["completed", "failed", "cancelled", "rolled_back"].includes(r.status));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ERP Autopilot</h1>
          <p className="text-sm text-muted-foreground">Phased execution with human-in-the-loop approval</p>
        </div>
        <div className="flex-1" />
        <Badge variant="outline" className="gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {activeRuns.length} active
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No autopilot runs yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Ask Architect to "run autopilot" on any ERP task — it will create a structured execution plan for your review.
          </p>
        </div>
      ) : (
        <>
          {activeRuns.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Runs</h2>
              <div className="space-y-3">
                {activeRuns.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    actions={actionsMap[run.id] || []}
                    expanded={expandedRun === run.id}
                    onToggle={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    onApproveRun={() => approveRun.mutate(run.id)}
                    onRejectRun={() => rejectRun.mutate(run.id)}
                    onApproveAction={(id) => approveAction.mutate(id)}
                    onRejectAction={(id) => rejectAction.mutate(id)}
                    onExecuteRun={() => executeRun.mutate(run.id)}
                    isExecuting={executeRun.isPending}
                    getPhaseIndex={getPhaseIndex}
                  />
                ))}
              </div>
            </section>
          )}

          {completedRuns.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">History</h2>
              <div className="space-y-3">
                {completedRuns.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    actions={actionsMap[run.id] || []}
                    expanded={expandedRun === run.id}
                    onToggle={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    onApproveRun={() => {}}
                    onRejectRun={() => {}}
                    onApproveAction={() => {}}
                    onRejectAction={() => {}}
                    onExecuteRun={() => executeRun.mutate(run.id)}
                    isExecuting={executeRun.isPending}
                    getPhaseIndex={getPhaseIndex}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

interface RunCardProps {
  run: AutopilotRun;
  actions: AutopilotAction[];
  expanded: boolean;
  onToggle: () => void;
  onApproveRun: () => void;
  onRejectRun: () => void;
  onApproveAction: (id: string) => void;
  onRejectAction: (id: string) => void;
  onExecuteRun: () => void;
  isExecuting: boolean;
  getPhaseIndex: (phase: string) => number;
}

function RunCard({
  run, actions, expanded, onToggle, onApproveRun, onRejectRun,
  onApproveAction, onRejectAction, onExecuteRun, isExecuting, getPhaseIndex,
}: RunCardProps) {
  const currentPhaseIdx = getPhaseIndex(run.phase);
  const isAwaitingApproval = run.status === "awaiting_approval";
  const isApproved = run.status === "approved";
  const isFailed = run.status === "failed";
  const isTerminal = ["completed", "failed", "cancelled", "rolled_back"].includes(run.status);
  const metrics = run.metrics as Record<string, number> | null;
  const simResult = run.simulation_result as Record<string, unknown> | null;

  // Lock detection
  const isLocked = !!run.execution_lock_uuid && run.status === "executing";
  const canResume = isFailed;

  return (
    <div className={cn(
      "rounded-xl border bg-card/80 backdrop-blur-sm transition-all",
      isAwaitingApproval ? "border-amber-500/40 shadow-amber-500/10 shadow-lg" : 
      isApproved ? "border-green-500/40 shadow-green-500/10 shadow-lg" :
      isLocked ? "border-blue-500/40 shadow-blue-500/10 shadow-lg" : "border-border/50",
      isTerminal && !isFailed && "opacity-80"
    )}>
      {/* Run Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{run.title}</span>
            <Badge className={cn("text-[10px] px-1.5 py-0 border", STATUS_COLORS[run.status] || "")}>
              {run.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {run.trigger_type}
            </Badge>
            {isLocked && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-400">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Execution in progress by another session</p>
                    {run.execution_started_at && (
                      <p className="text-xs text-muted-foreground">Started: {format(new Date(run.execution_started_at), "HH:mm:ss")}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {run.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{run.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {format(new Date(run.created_at), "MMM d, HH:mm")}
        </span>
      </button>

      {/* Phase Progress Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          {PHASE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isPast = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx;
            const isFailedPhase = run.status === "failed" && isCurrent;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full border transition-all",
                  isPast && "bg-green-600/20 border-green-600/40 text-green-500",
                  isCurrent && !isFailedPhase && "bg-blue-500/20 border-blue-500/40 text-blue-400 ring-2 ring-blue-500/20",
                  isFailedPhase && "bg-destructive/20 border-destructive/40 text-destructive",
                  !isPast && !isCurrent && "border-border/40 text-muted-foreground/30",
                )}>
                  {isPast ? <CheckCircle className="w-3 h-3" /> : isFailedPhase ? <XCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                </div>
                {i < PHASE_STEPS.length - 1 && (
                  <div className={cn("flex-1 h-0.5 rounded-full", isPast ? "bg-green-600/40" : "bg-border/30")} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {PHASE_STEPS.map((step) => (
            <span key={step.key} className="text-[9px] text-muted-foreground/60 w-6 text-center">{step.label}</span>
          ))}
        </div>
      </div>

      {/* Simulation Preview */}
      {expanded && simResult && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-xs space-y-1">
            <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Simulation Summary</h4>
            <div className="flex gap-4 flex-wrap">
              <span>Total: <strong>{simResult.total_actions as number}</strong></span>
              {(simResult.low_risk as number) > 0 && <span className="text-green-500">Low: {simResult.low_risk as number}</span>}
              {(simResult.medium_risk as number) > 0 && <span className="text-amber-400">Med: {simResult.medium_risk as number}</span>}
              {(simResult.high_risk as number) > 0 && <span className="text-orange-400">High: {simResult.high_risk as number}</span>}
              {(simResult.critical_risk as number) > 0 && <span className="text-destructive">Critical: {simResult.critical_risk as number}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Metrics (for completed/failed runs) */}
      {expanded && metrics && isTerminal && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-muted/30 border border-border/30 p-3 text-xs space-y-1">
            <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Execution Metrics</h4>
            <div className="flex gap-4 flex-wrap">
              <span>Executed: <strong className="text-green-500">{metrics.executed_actions}</strong></span>
              <span>Failed: <strong className="text-destructive">{metrics.failed_actions}</strong></span>
              {metrics.skipped_actions != null && <span>Skipped: <strong>{metrics.skipped_actions}</strong></span>}
              <span>Duration: <strong>{metrics.duration_ms}ms</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(isAwaitingApproval || isApproved || canResume) && (
        <div className="flex items-center gap-2 px-4 pb-3">
          {isAwaitingApproval && (
            <>
              <Button size="sm" onClick={onApproveRun} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="w-3.5 h-3.5" /> Approve Run
              </Button>
              <Button size="sm" variant="outline" onClick={onRejectRun} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {isApproved && (
            <Button
              size="sm"
              onClick={onExecuteRun}
              disabled={isExecuting || isLocked}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
              {isExecuting ? "Executing…" : isLocked ? "Locked" : "Execute Run"}
            </Button>
          )}
          {canResume && (
            <Button
              size="sm"
              onClick={onExecuteRun}
              disabled={isExecuting}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isExecuting ? "Resuming…" : "Resume Run"}
            </Button>
          )}
        </div>
      )}

      {/* Expanded: Actions List */}
      {expanded && actions.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions ({actions.length})</h4>
          {actions.map((action) => (
            <div key={action.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border/40 text-xs font-mono text-muted-foreground flex-shrink-0 mt-0.5">
                {action.step_order + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground font-mono">{action.tool_name}</span>
                  <Badge className={cn("text-[10px] px-1.5 py-0", RISK_COLORS[action.risk_level] || "")}>
                    {action.risk_level}
                  </Badge>
                  <span className={cn("text-xs font-medium", ACTION_STATUS_COLORS[action.status] || "")}>
                    {action.status}
                  </span>
                </div>
                <pre className="text-[11px] text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap font-mono">
                  {JSON.stringify(action.tool_params, null, 2).slice(0, 300)}
                  {JSON.stringify(action.tool_params).length > 300 && "..."}
                </pre>
                {action.error_message && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {action.error_message}
                  </p>
                )}
                {action.result && (
                  <p className="text-xs text-green-500 mt-1">✅ Completed{action.executed_at ? ` at ${format(new Date(action.executed_at), "HH:mm:ss")}` : ""}</p>
                )}
                {action.rollback_executed && (
                  <p className="text-xs text-orange-400 mt-1 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Rolled back</p>
                )}
              </div>
              {/* Per-action approve/reject */}
              {action.status === "pending" && action.requires_approval && isAwaitingApproval && (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => onApproveAction(action.id)}
                    className="p-1.5 rounded-md bg-green-600/20 text-green-500 hover:bg-green-600/30 transition-colors"
                    title="Approve action"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRejectAction(action.id)}
                    className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                    title="Reject action"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && actions.length === 0 && (
        <div className="border-t border-border/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No actions recorded for this run yet.
        </div>
      )}

      {/* Error Log */}
      {expanded && Array.isArray(run.error_log) && run.error_log.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3">
          <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Errors</h4>
          {run.error_log.map((err: any, i: number) => (
            <p key={i} className="text-xs text-destructive/80 font-mono">{typeof err === "string" ? err : JSON.stringify(err)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
