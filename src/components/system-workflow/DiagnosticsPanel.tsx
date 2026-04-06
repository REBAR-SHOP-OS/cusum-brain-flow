import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  DiagnosticIssue,
  RepairHandlerRegistry,
  RepairStep,
  WorkflowRegistry,
} from "@/types/workflowDiagram";

function severityBadge(sev: DiagnosticIssue["severity"]) {
  switch (sev) {
    case "critical":
      return { label: "Critical", variant: "destructive" as const };
    case "high":
      return { label: "High", variant: "destructive" as const };
    case "medium":
      return { label: "Medium", variant: "secondary" as const };
    default:
      return { label: "Low", variant: "outline" as const };
  }
}

export type DiagnosticsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: WorkflowRegistry;
  issues: DiagnosticIssue[];
  repairHandlers: RepairHandlerRegistry;
  getRepairSteps?: (issueId: string) => { title: string; steps: RepairStep[] } | undefined;
  onInspectModuleId?: (moduleId: string) => void;
};

type FixState =
  | { step: "list" }
  | { step: "details"; issueId: string }
  | { step: "fix_flow"; issueId: string; status: "confirm" | "running" | "done"; result?: { ok: boolean; message: string } };

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const { open, onOpenChange, registry, issues, repairHandlers, getRepairSteps, onInspectModuleId } = props;
  const [state, setState] = useState<FixState>({ step: "list" });
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());

  const visibleIssues = useMemo(() => issues.filter((i) => !resolved.has(i.id)), [issues, resolved]);

  const selectedIssue =
    state.step === "details" || state.step === "fix_flow" ? issues.find((i) => i.id === state.issueId) ?? null : null;

  const openDetails = (issueId: string) => setState({ step: "details", issueId });
  const openFixFlow = (issueId: string) => setState({ step: "fix_flow", issueId, status: "confirm" });

  const markResolved = (issueId: string) => {
    setResolved((prev) => new Set([...prev, issueId]));
    setState({ step: "list" });
  };

  const runFix = async (issue: DiagnosticIssue) => {
    setState({ step: "fix_flow", issueId: issue.id, status: "running" });
    const handler = repairHandlers[issue.category];
    try {
      const res = handler
        ? await handler({ issue, registry })
        : await new Promise<{ ok: boolean; message: string }>((r) =>
            setTimeout(() => r({ ok: true, message: "Mock repair handler not attached; simulated fix completed." }), 1100),
          );
      setState({ step: "fix_flow", issueId: issue.id, status: "done", result: res });
    } catch (e) {
      setState({
        step: "fix_flow",
        issueId: issue.id,
        status: "done",
        result: { ok: false, message: e instanceof Error ? e.message : "Repair failed." },
      });
    }
  };

  return (
    <div
      className={cn(
        "fixed right-6 top-6 z-50 w-[420px] rounded-2xl border border-white/10 bg-slate-950/75 p-4 text-white shadow-2xl backdrop-blur-xl",
        !open && "pointer-events-none opacity-0",
      )}
      role="dialog"
      aria-label="Failure report and diagnostics"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-cyan-200" />
            <div className="text-sm font-semibold tracking-tight">Failure Report / Diagnostics</div>
          </div>
          <div className="mt-1 text-xs text-white/70">Detected failures, unhealthy modules, and suggested fixes.</div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => {
            onOpenChange(false);
            setState({ step: "list" });
          }}
        >
          Close
        </Button>
      </div>

      <div className="mt-3">
        <Tabs defaultValue="issues">
          <TabsList className="w-full bg-white/5">
            <TabsTrigger value="issues" className="flex-1 data-[state=active]:bg-white/10">
              Issues ({visibleIssues.length})
            </TabsTrigger>
            <TabsTrigger value="health" className="flex-1 data-[state=active]:bg-white/10">
              Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="mt-3">
            {state.step === "list" && (
              <div className="space-y-2">
                {visibleIssues.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                    No active issues.
                  </div>
                ) : (
                  visibleIssues.map((issue) => {
                    const sev = severityBadge(issue.severity);
                    return (
                      <div key={issue.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-200" />
                              <div className="truncate text-sm font-semibold">{issue.title}</div>
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-white/70">{issue.description}</div>
                          </div>
                          <Badge variant={sev.variant} className="shrink-0">
                            {sev.label}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {issue.affectedModuleIds.slice(0, 4).map((mid) => (
                            <button
                              key={mid}
                              type="button"
                              onClick={() => onInspectModuleId?.(mid)}
                              className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/10"
                              title="Inspect module"
                            >
                              {registry.modules[mid]?.name ?? mid}
                            </button>
                          ))}
                          {issue.affectedModuleIds.length > 4 && (
                            <span className="rounded-full border border-white/10 bg-slate-950/30 px-2 py-0.5 text-[10px] text-white/60">
                              +{issue.affectedModuleIds.length - 4} more
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-[10px] text-white/50">Last seen: {new Date(issue.lastDetectedAt).toLocaleString()}</div>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 bg-white/10 text-white hover:bg-white/15"
                              onClick={() => openDetails(issue.id)}
                            >
                              View details
                              <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                            {issue.actions.includes("fix_now") && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                                onClick={() => openFixFlow(issue.id)}
                              >
                                Fix now
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {state.step === "details" && selectedIssue && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{selectedIssue.title}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => setState({ step: "list" })}
                  >
                    Back
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                  {selectedIssue.description}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-white/80">Suggested fixes</div>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-white/70">
                    {selectedIssue.suggestedFixes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => markResolved(selectedIssue.id)}
                  >
                    Mark resolved
                  </Button>
                  {selectedIssue.actions.includes("fix_now") && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                      onClick={() => openFixFlow(selectedIssue.id)}
                    >
                      Fix now
                    </Button>
                  )}
                </div>
              </div>
            )}

            {state.step === "fix_flow" && selectedIssue && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Guided fix</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => setState({ step: "details", issueId: selectedIssue.id })}
                  >
                    Back
                  </Button>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-white/80">{selectedIssue.title}</div>
                  <div className="mt-1 text-xs text-white/70">
                    Severity: <span className="font-medium text-white/85">{selectedIssue.severity}</span> · Category:{" "}
                    <span className="font-medium text-white/85">{selectedIssue.category}</span>
                  </div>
                </div>

                {(() => {
                  const runbook = getRepairSteps?.(selectedIssue.id);
                  if (!runbook) return null;
                  return (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs font-semibold text-white/80">{runbook.title}</div>
                      <ol className="mt-2 space-y-2">
                        {runbook.steps.map((s) => (
                          <li key={s.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
                            <div className="text-xs font-semibold text-white/80">{s.title}</div>
                            <div className="mt-0.5 text-xs text-white/70">{s.description}</div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}

                {state.status === "confirm" && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-white/10 text-white hover:bg-white/15"
                      onClick={() => setState({ step: "details", issueId: selectedIssue.id })}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                      onClick={() => runFix(selectedIssue)}
                    >
                      Confirm fix
                    </Button>
                  </div>
                )}

                {state.status === "running" && (
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/75">Running repair steps…</div>
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                  </div>
                )}

                {state.status === "done" && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/85">
                      {state.result?.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-200" />
                      )}
                      {state.result?.ok ? "Repair completed" : "Repair failed"}
                    </div>
                    <div className="mt-1 text-xs text-white/70">{state.result?.message ?? "No result."}</div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 bg-white/10 text-white hover:bg-white/15"
                        onClick={() => setState({ step: "details", issueId: selectedIssue.id })}
                      >
                        View details
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                        onClick={() => markResolved(selectedIssue.id)}
                      >
                        Mark resolved
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="health" className="mt-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
              Health rollups will connect to real telemetry later. For now, use the workflow filters (errors / warnings / healthy)
              on the diagram to see state overlays.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

