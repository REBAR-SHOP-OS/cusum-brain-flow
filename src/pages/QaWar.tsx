import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Play, Download, Bug, Shield, Zap, AlertTriangle, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const SEVERITY_COLORS: Record<string, string> = {
  S0: "bg-red-600 text-white",
  S1: "bg-orange-500 text-white",
  S2: "bg-yellow-500 text-black",
  S3: "bg-blue-400 text-white",
};

const CATEGORY_ICONS: Record<string, typeof Bug> = {
  normal: TrendingUp,
  edge_case: AlertTriangle,
  concurrency: Zap,
  permission_abuse: Shield,
  integration: Bug,
  corrupt_data: AlertTriangle,
  stress: Zap,
};

export default function QaWar() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Fetch runs
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["qa-war-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_war_runs")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch bugs for selected run
  const { data: bugs, isLoading: bugsLoading } = useQuery({
    queryKey: ["qa-war-bugs", selectedRun],
    queryFn: async () => {
      if (!selectedRun) return [];
      const { data, error } = await supabase
        .from("qa_war_bugs")
        .select("*")
        .eq("run_id", selectedRun)
        .order("severity", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRun,
  });

  // Start run mutation
  const startRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("qa-war-engine", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("QA War complete!", { description: `Found ${data.total_bugs} bugs` });
      queryClient.invalidateQueries({ queryKey: ["qa-war-runs"] });
      if (data.run_id) setSelectedRun(data.run_id);
    },
    onError: (err: any) => {
      toast.error("QA War failed", { description: err.message });
    },
  });

  const activeRun = runs?.find((r: any) => r.id === selectedRun);
  const summary = activeRun?.summary as any;

  // Filter bugs
  const filteredBugs = (bugs || []).filter((b: any) => {
    if (filterModule !== "all" && b.module !== filterModule) return false;
    if (filterSeverity !== "all" && b.severity !== filterSeverity) return false;
    if (filterCategory !== "all" && b.scenario_category !== filterCategory) return false;
    return true;
  });

  const uniqueModules = [...new Set((bugs || []).map((b: any) => b.module))];
  const uniqueCategories = [...new Set((bugs || []).map((b: any) => b.scenario_category))];

  const exportBugs = () => {
    if (!filteredBugs.length) return;
    const blob = new Blob([JSON.stringify(filteredBugs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-war-bugs-${selectedRun?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔥 QA War Engine</h1>
          <p className="text-muted-foreground text-sm">
            500-scenario AI stress simulation against your live schema
          </p>
        </div>
        <Button
          onClick={() => startRun.mutate()}
          disabled={startRun.isPending}
          size="lg"
          className="gap-2"
        >
          {startRun.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running War... (~3 min)
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Launch QA War
            </>
          )}
        </Button>
      </div>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !runs?.length ? (
            <p className="text-muted-foreground text-sm">No runs yet. Launch your first QA War!</p>
          ) : (
            <div className="grid gap-2">
              {runs.map((run: any) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                    selectedRun === run.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={run.status === "completed" ? "default" : run.status === "running" ? "secondary" : "destructive"}>
                      {run.status}
                    </Badge>
                    <span className="text-sm font-mono">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{run.bugs_found}</span>
                    <span className="text-xs text-muted-foreground">/ {run.total_scenarios}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Panel */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold">{summary.total_bugs}</div>
              <div className="text-xs text-muted-foreground">Total Bugs Found</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-red-500">
                {(summary.by_severity?.S0 || 0) + (summary.by_severity?.S1 || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Critical (S0 + S1)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold">{summary.technical_debt_score}/100</div>
              <div className="text-xs text-muted-foreground">Technical Debt Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm font-medium mb-1">Top Risk Modules</div>
              <div className="space-y-1">
                {(summary.top_risk_modules || []).slice(0, 3).map((m: string, i: number) => (
                  <div key={i} className="text-xs text-muted-foreground">{m}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bug Registry */}
      {selectedRun && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Bug Registry</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sev</SelectItem>
                    <SelectItem value="S0">S0</SelectItem>
                    <SelectItem value="S1">S1</SelectItem>
                    <SelectItem value="S2">S2</SelectItem>
                    <SelectItem value="S3">S3</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {uniqueModules.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportBugs} className="gap-1">
                  <Download className="h-3 w-3" /> Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bugsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredBugs.length ? (
              <p className="text-muted-foreground text-sm text-center py-8">No bugs match filters</p>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Sev</TableHead>
                      <TableHead className="w-[80px]">Module</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[80px]">Type</TableHead>
                      <TableHead className="w-[100px]">Category</TableHead>
                      <TableHead className="w-[70px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBugs.map((bug: any) => (
                      <TableRow key={bug.id} className="group cursor-pointer">
                        <TableCell>
                          <Badge className={`${SEVERITY_COLORS[bug.severity]} text-xs`}>
                            {bug.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{bug.module}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{bug.title}</div>
                            <div className="text-xs text-muted-foreground hidden group-hover:block">
                              <strong>Root Cause:</strong> {bug.suspected_root_cause}
                            </div>
                            <div className="text-xs text-muted-foreground hidden group-hover:block">
                              <strong>Fix:</strong> {bug.fix_proposal}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{bug.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{bug.scenario_category}</TableCell>
                        <TableCell>
                          <Badge variant={bug.status === "new" ? "default" : bug.status === "regression" ? "destructive" : "secondary"} className="text-xs">
                            {bug.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
