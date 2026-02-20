import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Brain, TrendingUp, Target, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function CoordinationDashboard() {
  const [ingesting, setIngesting] = useState<string | null>(null);

  // Coordination logs
  const { data: coordLogs = [] } = useQuery({
    queryKey: ["coordination_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_coordination_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as any[];
    },
  });

  // Ingestion progress
  const { data: progress = [], refetch: refetchProgress } = useQuery({
    queryKey: ["ingestion_progress"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ingestion_progress")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  // Learning pairs
  const { data: learnings = [] } = useQuery({
    queryKey: ["estimation_learnings_stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimation_learnings")
        .select("element_type, bar_size, weight_delta_pct, confidence_score, source, created_at")
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

  const triggerIngestion = async (functionName: string) => {
    setIngesting(functionName);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { batch_size: 10 },
      });
      if (error) throw error;
      toast.success(data?.message ?? "Batch processed");
      refetchProgress();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

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

      {/* Ingestion Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ingestion Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => triggerIngestion("ingest-historical-barlists")}
              disabled={!!ingesting}
            >
              {ingesting === "ingest-historical-barlists" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Ingest Bar Lists
            </Button>
            <Button
              size="sm"
              onClick={() => triggerIngestion("ingest-job-logs")}
              disabled={!!ingesting}
            >
              {ingesting === "ingest-job-logs" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Ingest Job Logs
            </Button>
            <Button
              size="sm"
              onClick={() => triggerIngestion("build-learning-pairs")}
              disabled={!!ingesting}
            >
              {ingesting === "build-learning-pairs" ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Build Learning Pairs
            </Button>
          </div>

          {progress.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3">
              <Badge variant={p.status === "completed" ? "default" : p.status === "running" ? "secondary" : "outline"}>
                {p.job_type}
              </Badge>
              <Progress value={p.total_items > 0 ? (p.processed_items / p.total_items) * 100 : 0} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground">
                {p.processed_items}/{p.total_items} ({p.status})
              </span>
            </div>
          ))}
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
