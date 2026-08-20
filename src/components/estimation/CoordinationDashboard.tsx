import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Brain, TrendingUp, Target, AlertTriangle, Play, RefreshCw, RotateCcw, Eye, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export default function CoordinationDashboard() {
  const { companyId } = useCompanyId();
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState<Record<string, boolean>>({});
  const autoRunRef = useRef(autoRun);
  useEffect(() => { autoRunRef.current = autoRun; }, [autoRun]);

  // Coordination logs
  const { data: coordLogs = [] } = useQuery({
    queryKey: ["coordination_logs", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_coordination_log")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as any[];
    },
  });

  // Ingestion progress
  const { data: progress = [], refetch: refetchProgress } = useQuery({
    queryKey: ["ingestion_progress", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ingestion_progress")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    refetchInterval: 3000,
  });

  // Learning pairs
  const { data: learnings = [] } = useQuery({
    queryKey: ["estimation_learnings_stats", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("estimation_learnings")
        .select("element_type, bar_size, weight_delta_pct, confidence_score, source, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data ?? []) as any[];
    },
  });

  // Compute chart data
  const weightComparisonData = coordLogs
    .filter((l: any) => l.estimation_weight_kg > 0 && l.detailing_weight_kg > 0)
    .slice(0, 20)
    .map((l: any) => ({
      name: (l.project_name ?? "").substring(0, 20),
      estimation: Math.round(l.estimation_weight_kg),
      actual: Math.round(l.detailing_weight_kg),
      delta: Math.round(l.weight_difference_kg),
    }));

  const elementAccuracy = (() => {
    const byType: Record<string, { count: number; totalDelta: number }> = {};
    for (const l of learnings) {
      const et = l.element_type ?? "unknown";
      if (!byType[et]) byType[et] = { count: 0, totalDelta: 0 };
      byType[et].count++;
      byType[et].totalDelta += Math.abs(l.weight_delta_pct ?? 0);
    }
    return Object.entries(byType).map(([type, stats]) => ({
      type,
      accuracy: Math.max(0, 100 - stats.totalDelta / stats.count),
      samples: stats.count,
    }));
  })();

  const avgAccuracy = learnings.length > 0
    ? Math.round(learnings.reduce((s: number, l: any) => s + (l.confidence_score ?? 0), 0) / learnings.length)
    : 0;

  const triggerIngestion = useCallback(async (functionName: string, isAutoRun = false) => {
    setIngesting(functionName);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { batch_size: functionName === "ingest-shop-drawings" ? 2 : 5 },
      });
      if (error) throw error;

      const hasMore = data?.has_more ?? false;
      toast.success(`${data?.message ?? "Batch processed"}${hasMore ? " — more batches remaining" : " — done!"}`);
      refetchProgress();

      // Auto-continue if enabled
      if (hasMore && autoRunRef.current[functionName]) {
        setTimeout(() => triggerIngestion(functionName, true), 1500);
      } else if (!hasMore) {
        setAutoRun((prev) => ({ ...prev, [functionName]: false }));
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
      setAutoRun((prev) => ({ ...prev, [functionName]: false }));
    } finally {
      if (!autoRunRef.current[functionName]) setIngesting(null);
    }
  }, [refetchProgress]);

  const resetPipeline = async (jobType: string) => {
    const fnMap: Record<string, string> = {
      barlists: "ingest-historical-barlists",
      job_logs: "ingest-job-logs",
      shop_drawings: "ingest-shop-drawings",
    };
    const fn = fnMap[jobType];
    if (!fn) return;

    try {
      await supabase.functions.invoke(fn, { body: { reset: true, batch_size: 0 } });
      toast.success(`${jobType} pipeline reset`);
      refetchProgress();
    } catch (e: any) {
      toast.error(`Reset failed: ${e.message}`);
    }
  };

  const toggleAutoRun = (functionName: string, enabled: boolean) => {
    setAutoRun((prev) => ({ ...prev, [functionName]: enabled }));
    if (enabled) {
      triggerIngestion(functionName, true);
    }
  };

  const pipelines = [
    { key: "barlists", fn: "ingest-historical-barlists", label: "Bar Lists (XLS)", icon: FileSpreadsheet, description: "Parse all RebarCAD XLS exports" },
    { key: "job_logs", fn: "ingest-job-logs", label: "Job Logs (XLS)", icon: FileText, description: "Extract estimation vs actual weights" },
    { key: "shop_drawings", fn: "ingest-shop-drawings", label: "Shop Drawings (AI Vision)", icon: Eye, description: "Gemini Pro extracts rebar from PDFs" },
    { key: "learning_pairs", fn: "build-learning-pairs", label: "Build Learning Pairs", icon: Brain, description: "Cross-reference XLS & PDF data" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Learning Engine — Coordination Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Training AI from {coordLogs.length} coordination logs, {learnings.length} learning pairs
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Target className="h-4 w-4" /> Overall Accuracy
            </div>
            <p className="text-2xl font-bold mt-1">{avgAccuracy}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Brain className="h-4 w-4" /> Learning Pairs
            </div>
            <p className="text-2xl font-bold mt-1">{learnings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-4 w-4" /> Coordination Logs
            </div>
            <p className="text-2xl font-bold mt-1">{coordLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <AlertTriangle className="h-4 w-4" /> Avg Weight Delta
            </div>
            <p className="text-2xl font-bold mt-1">
              {coordLogs.length > 0
                ? `${(coordLogs.reduce((s: number, l: any) => s + (l.weight_difference_kg ?? 0), 0) / coordLogs.length).toFixed(0)} kg`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Pipeline Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Ingestion Pipeline
            <Badge variant="outline" className="text-xs">
              {progress.filter((p: any) => p.status === "completed").length}/{pipelines.length} complete
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pipelines.map(({ key, fn, label, icon: Icon, description }) => {
            const p = progress.find((pr: any) => pr.job_type === key);
            const isRunning = ingesting === fn || autoRun[fn];
            const totalFiles = p?.total_files ?? p?.total_items ?? 0;
            const processedFiles = p?.processed_files ?? p?.processed_items ?? 0;
            const pct = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

            return (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                    {p && (
                      <Badge variant={p.status === "completed" ? "default" : p.status === "running" ? "secondary" : "outline"} className="text-xs">
                        {p.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {key !== "learning_pairs" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Auto</span>
                        <Switch
                          checked={autoRun[fn] ?? false}
                          onCheckedChange={(checked) => toggleAutoRun(fn, checked)}
                          disabled={isRunning && !autoRun[fn]}
                        />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPipeline(key)}
                      disabled={isRunning}
                      title="Reset pipeline"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => triggerIngestion(fn)}
                      disabled={isRunning}
                    >
                      {isRunning ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                      Run
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
                {p && (
                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {processedFiles}/{totalFiles} files ({pct}%)
                    </span>
                  </div>
                )}
                {p?.failed_items > 0 && (
                  <p className="text-xs text-destructive">{p.failed_items} failed</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Tabs defaultValue="weight">
        <TabsList>
          <TabsTrigger value="weight">Weight Comparison</TabsTrigger>
          <TabsTrigger value="accuracy">Element Accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="weight">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Estimation vs. Actual Weight</CardTitle>
            </CardHeader>
            <CardContent>
              {weightComparisonData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weightComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="estimation" fill="hsl(var(--primary))" name="Estimated (kg)" />
                    <Bar dataKey="actual" fill="hsl(var(--chart-2))" name="Actual (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No coordination data yet. Run the ingestion pipeline to populate.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accuracy by Element Type</CardTitle>
            </CardHeader>
            <CardContent>
              {elementAccuracy.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={elementAccuracy}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="accuracy" fill="hsl(var(--chart-1))" name="Accuracy %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No learning data yet. Build learning pairs to populate.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
