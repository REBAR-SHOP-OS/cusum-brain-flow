import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePaginatedFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Sparkles, Bot, User, Zap, Loader2, CheckCircle, AlertTriangle, Radar, Wrench } from "lucide-react";
import { toast } from "sonner";

const columns = ["open", "in_progress", "done"] as const;
const columnLabels: Record<string, string> = { open: "Open", in_progress: "In Progress", done: "Done" };
const priorityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-orange-500/10 text-orange-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-blue-500/10 text-blue-500",
};
const taskTypeColors: Record<string, string> = {
  content: "bg-purple-500/10 text-purple-600",
  technical: "bg-orange-500/10 text-orange-600",
  internal_link: "bg-blue-500/10 text-blue-600",
  local: "bg-orange-500/10 text-orange-600",
  ai_visibility: "bg-violet-500/10 text-violet-600",
};

interface AnalyzeResult {
  can_execute: boolean;
  plan_summary: string;
  actions?: { type: string; target: string; field?: string; value?: string }[];
  human_steps?: string;
}

interface SmartScanResult {
  sources_synced: string[];
  analysis: { keywords_analyzed: number; pages_analyzed: number; insights_created: number; tasks_created: number } | null;
  auto_fixed: number;
  manual_required: number;
  auto_fix_details: string[];
}

export function SeoTasks() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyzingTaskId, setAnalyzingTaskId] = useState<string | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SmartScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  // Get domain_id
  const { data: domainData } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("id").limit(1).single();
      return data;
    },
  });

  const { data: tasks, isLoading, error: tasksError } = useQuery({
    queryKey: ["seo-tasks"],
    queryFn: async () => {
      try {
        return await fetchAllRows(() =>
          supabase
            .from("seo_tasks")
            .select("*")
            .order("created_at", { ascending: false })
        );
      } catch (e) {
        console.error("[SeoTasks] fetchAllRows failed, falling back to direct query:", e);
        const { data, error } = await supabase
          .from("seo_tasks")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      }
    },
  });

  if (tasksError) {
    console.error("[SeoTasks] query error:", tasksError);
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("seo_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-tasks"] });
      toast.success("Task updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSmartScan = async () => {
    if (!domainData?.id) {
      toast.error("No SEO domain configured");
      return;
    }
    setScanning(true);
    setScanResult(null);
    setScanProgress(10);

    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + 5, 90));
    }, 3000);

    try {
      const { data, error } = await supabase.functions.invoke("seo-smart-scan", {
        body: { domain_id: domainData.id },
      });
      if (error) throw error;
      setScanResult(data);
      setScanProgress(100);
      qc.invalidateQueries({ queryKey: ["seo-tasks"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-pages"] });
      toast.success(`Smart Scan complete! ${data.auto_fixed} auto-fixed, ${data.manual_required} need attention.`);
    } catch (err: any) {
      toast.error(err.message || "Smart Scan failed");
    } finally {
      clearInterval(progressInterval);
      setScanning(false);
    }
  };

  const handleAnalyze = async (taskId: string) => {
    setAnalyzingTaskId(taskId);
    setCurrentTaskId(taskId);
    try {
      const { data, error } = await supabase.functions.invoke("seo-task-execute", {
        body: { task_id: taskId, phase: "analyze" },
      });
      if (error) throw error;
      setAnalyzeResult(data);
      setDialogOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze task");
    } finally {
      setAnalyzingTaskId(null);
    }
  };

  const handleExecute = async () => {
    if (!currentTaskId) return;
    setExecutingTaskId(currentTaskId);
    try {
      const { data, error } = await supabase.functions.invoke("seo-task-execute", {
        body: { task_id: currentTaskId, phase: "execute" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Done — task completed", {
          description: data.results?.join(", "),
        });
        qc.invalidateQueries({ queryKey: ["seo-tasks"] });
      } else {
        toast.error(data?.error || "Execution failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Execution failed");
    } finally {
      setExecutingTaskId(null);
      setDialogOpen(false);
      setAnalyzeResult(null);
      setCurrentTaskId(null);
    }
  };

  const handleMoveToInProgress = async () => {
    if (!currentTaskId) return;
    updateStatus.mutate({ id: currentTaskId, status: "in_progress" });
    setDialogOpen(false);
    setAnalyzeResult(null);
    setCurrentTaskId(null);
  };

  const grouped = {
    open: tasks?.filter((t: any) => t.status === "open") || [],
    in_progress: tasks?.filter((t: any) => t.status === "in_progress") || [],
    done: tasks?.filter((t: any) => t.status === "done") || [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SEO Action Items</h1>
          <p className="text-sm text-muted-foreground">Automated and manual tasks to improve search performance</p>
        </div>
        <Button
          onClick={handleSmartScan}
          disabled={scanning}
          className="gap-2"
        >
          {scanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><Radar className="w-4 h-4" /> Smart Scan</>
          )}
        </Button>
      </div>

      {/* Scan Progress */}
      {scanning && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Scanning all connected sources, analyzing data, and auto-fixing issues…
            </div>
            <Progress value={scanProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">This may take 1-2 minutes</p>
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanResult && !scanning && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Smart Scan Complete
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-lg font-bold">{scanResult.sources_synced.length}</p>
                <p className="text-xs text-muted-foreground">Sources Synced</p>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-lg font-bold">{scanResult.analysis?.tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Issues Found</p>
              </div>
              <div className="bg-green-500/10 rounded p-2 text-center">
                <p className="text-lg font-bold text-green-600">{scanResult.auto_fixed}</p>
                <p className="text-xs text-muted-foreground">Auto-Fixed</p>
              </div>
              <div className="bg-yellow-500/10 rounded p-2 text-center">
                <p className="text-lg font-bold text-yellow-600">{scanResult.manual_required}</p>
                <p className="text-xs text-muted-foreground">Need Attention</p>
              </div>
            </div>
            {scanResult.sources_synced.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {scanResult.sources_synced.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setScanResult(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{columnLabels[col]}</h3>
                <Badge variant="outline" className="text-xs">{grouped[col].length}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
                {grouped[col].length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                ) : (
                  grouped[col].map((task: any) => (
                    <Card key={task.id} className="shadow-sm">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium leading-tight">{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.created_by === "ai" && <Bot className="w-3 h-3 text-primary" />}
                            <Badge className={`text-[10px] ${priorityColors[task.priority] || ""}`}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        {task.ai_reasoning && (
                          <div className="bg-primary/5 rounded p-2 border border-primary/10">
                            <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Why this matters
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.ai_reasoning}</p>
                          </div>
                        )}
                        {task.expected_impact && (
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-medium">Impact:</span> {task.expected_impact}
                          </p>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          {task.task_type && (
                            <Badge className={`text-[10px] ${taskTypeColors[task.task_type] || ""}`}>
                              {task.task_type}
                            </Badge>
                          )}
                          {/* Auto-fix badge */}
                          {task.can_autofix === true && task.status !== "done" && (
                            <Badge className="text-[10px] bg-green-500/10 text-green-600 gap-0.5">
                              <Wrench className="w-2.5 h-2.5" /> Auto-Fix
                            </Badge>
                          )}
                          {task.can_autofix === false && task.status !== "done" && (
                            <Badge className="text-[10px] bg-yellow-500/10 text-yellow-600">
                              Manual
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {task.created_by === "ai" ? (
                              <span className="flex items-center gap-0.5"><Bot className="w-2.5 h-2.5" /> AI</span>
                            ) : (
                              <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> Manual</span>
                            )}
                          </Badge>
                        </div>
                        {task.entity_url && (
                          <a href={task.entity_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                            <ExternalLink className="w-3 h-3" /> {task.entity_url.substring(0, 50)}
                          </a>
                        )}

                        {/* Execute button - only for open/in_progress */}
                        {(task.status === "open" || task.status === "in_progress") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs gap-1"
                            disabled={analyzingTaskId === task.id}
                            onClick={() => handleAnalyze(task.id)}
                          >
                            {analyzingTaskId === task.id ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
                            ) : (
                              <><Zap className="w-3 h-3" /> Execute</>
                            )}
                          </Button>
                        )}

                        {/* Execution log for done tasks */}
                        {task.status === "done" && task.executed_by === "ai" && task.executed_at && (
                          <div className="bg-green-500/5 rounded p-1.5 border border-green-500/10">
                            <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> AI Executed
                            </p>
                          </div>
                        )}

                        {/* Human steps for non-autofix done/in_progress tasks */}
                        {task.execution_log?.human_steps && task.status !== "done" && (
                          <div className="bg-yellow-500/5 rounded p-2 border border-yellow-500/10">
                            <p className="text-[10px] text-yellow-600 font-medium mb-1">Steps to fix:</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">
                              {task.execution_log.human_steps}
                            </p>
                          </div>
                        )}

                        <Select value={task.status} onValueChange={(v) => updateStatus.mutate({ id: task.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execution Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {analyzeResult?.can_execute ? (
                 <><Zap className="w-5 h-5 text-primary" /> Execution Plan</>
              ) : (
                 <><AlertTriangle className="w-5 h-5 text-yellow-500" /> Manual Steps Required</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p className="text-sm">{analyzeResult?.plan_summary}</p>

                {analyzeResult?.can_execute && analyzeResult.actions?.length ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Planned actions:</p>
                    {analyzeResult.actions.map((action, i) => (
                      <div key={i} className="bg-muted/50 rounded p-2 text-xs space-y-0.5">
                        <p className="font-medium">{action.type.replace("wp_", "").replace(/_/g, " ")}</p>
                        <p className="text-muted-foreground">Target: {action.target}</p>
                        {action.field && <p className="text-muted-foreground">Field: {action.field}</p>}
                        {action.value && (
                          <p className="text-muted-foreground line-clamp-2">Value: {action.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : analyzeResult?.human_steps ? (
                  <div className="bg-yellow-500/5 rounded p-3 border border-yellow-500/10">
                    <p className="text-xs font-medium mb-1">What you need to do:</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {analyzeResult.human_steps}
                    </p>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!executingTaskId}>Cancel</AlertDialogCancel>
            {analyzeResult?.can_execute ? (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleExecute();
                }}
                disabled={!!executingTaskId}
                className="gap-1"
              >
                {executingTaskId ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Confirm & Execute</>
                )}
              </AlertDialogAction>
            ) : (
               <AlertDialogAction onClick={(e) => { e.preventDefault(); handleMoveToInProgress(); }}>
                 Mark as In Progress
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
