import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap, AlertTriangle, CheckCircle, RefreshCw, Gauge, Image, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SpeedIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  metric?: number;
  threshold?: number;
}

interface Recommendation {
  action: string;
  priority: number;
  title: string;
  description: string;
  requires_server_access: boolean;
}

interface AuditResult {
  ok: boolean;
  audited_at: string;
  ttfb: Record<string, number>;
  page_weight: Record<string, number>;
  avg_ttfb_ms: number;
  issues_found: number;
  issues: SpeedIssue[];
  recommendations_count: number;
  recommendations: Recommendation[];
}

interface OptimizerResult {
  ok: boolean;
  dry_run: boolean;
  items_scanned: number;
  items_modified: number;
  images_fixed: number;
  results: Array<{
    type: string;
    id: number;
    title: string;
    changes: string[];
    images_fixed: number;
  }>;
}

function MetricCard({ label, value, unit, status }: { label: string; value: number | string; unit: string; status: "good" | "warning" | "critical" }) {
  return (
    <Card className={cn(
      "p-3 border-l-4",
      status === "good" && "border-l-green-500",
      status === "warning" && "border-l-yellow-500",
      status === "critical" && "border-l-destructive",
    )}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
    </Card>
  );
}

export function SpeedDashboard() {
  const queryClient = useQueryClient();
  const [optimizerMode, setOptimizerMode] = useState<"dry_run" | "live">("dry_run");

  const auditQuery = useQuery<AuditResult>({
    queryKey: ["speed-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("website-speed-audit");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const optimizerMutation = useMutation<OptimizerResult, Error, boolean>({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("wp-speed-optimizer", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.success(`Scan complete: ${data.images_fixed} images can be optimized across ${data.items_modified} items`);
      } else {
        toast.success(`Optimized ${data.images_fixed} images across ${data.items_modified} items`);
      }
    },
    onError: (err) => toast.error(`Optimizer failed: ${err.message}`),
  });

  const audit = auditQuery.data;
  const getStatus = (ms: number, good: number, warn: number): "good" | "warning" | "critical" =>
    ms <= good ? "good" : ms <= warn ? "warning" : "critical";

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Speed Dashboard</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => { queryClient.invalidateQueries({ queryKey: ["speed-audit"] }); auditQuery.refetch(); }}
          disabled={auditQuery.isFetching}
        >
          {auditQuery.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run Audit
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Metrics */}
          {audit ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  label="Avg TTFB"
                  value={(audit.avg_ttfb_ms / 1000).toFixed(1)}
                  unit="s"
                  status={getStatus(audit.avg_ttfb_ms, 800, 2000)}
                />
                <MetricCard
                  label="Issues Found"
                  value={audit.issues_found}
                  unit=""
                  status={audit.issues_found === 0 ? "good" : audit.issues_found > 5 ? "critical" : "warning"}
                />
                {Object.entries(audit.ttfb).map(([page, ms]) => (
                  <MetricCard
                    key={page}
                    label={`TTFB: ${page}`}
                    value={(ms / 1000).toFixed(1)}
                    unit="s"
                    status={getStatus(ms, 800, 2000)}
                  />
                ))}
              </div>

              {/* Optimizer */}
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Image Optimizer</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adds lazy loading, decoding="async" to all images in posts, pages, and products.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => optimizerMutation.mutate(true)}
                    disabled={optimizerMutation.isPending}
                  >
                    {optimizerMutation.isPending && optimizerMode === "dry_run" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Scan (Dry Run)
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                    onClick={() => { setOptimizerMode("live"); optimizerMutation.mutate(false); }}
                    disabled={optimizerMutation.isPending}
                  >
                    {optimizerMutation.isPending && optimizerMode === "live" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Optimize Now
                  </Button>
                </div>

                {/* Optimizer Results */}
                {optimizerMutation.data && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span>
                        {optimizerMutation.data.dry_run ? "Would fix" : "Fixed"}{" "}
                        <strong>{optimizerMutation.data.images_fixed}</strong> images across{" "}
                        <strong>{optimizerMutation.data.items_modified}</strong> items
                        (scanned {optimizerMutation.data.items_scanned})
                      </span>
                    </div>
                    {optimizerMutation.data.results.slice(0, 5).map((r) => (
                      <div key={`${r.type}-${r.id}`} className="text-xs bg-muted rounded p-1.5">
                        <span className="font-medium">{r.title}</span>
                        <span className="text-muted-foreground ml-1">({r.type})</span>
                        <ul className="mt-0.5 text-muted-foreground">
                          {r.changes.slice(0, 3).map((c, i) => <li key={i}>• {c}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Issues */}
              {audit.issues.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Issues</h3>
                  {audit.issues.map((issue, i) => (
                    <Card key={i} className="p-2 flex items-start gap-2">
                      {issue.severity === "critical" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      ) : issue.severity === "warning" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{issue.title}</p>
                        <p className="text-xs text-muted-foreground">{issue.description}</p>
                      </div>
                      <Badge variant={issue.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {issue.severity}
                      </Badge>
                    </Card>
                  ))}
                </div>
              )}

              {/* Server-side Recommendations */}
              {audit.recommendations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase">Server-Side Recommendations</h3>
                  </div>
                  {audit.recommendations.map((rec, i) => (
                    <Card key={i} className="p-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">P{rec.priority}</Badge>
                        <p className="text-xs font-medium">{rec.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : auditQuery.isFetching ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Running speed audit...</span>
            </div>
          ) : auditQuery.isError ? (
            <div className="text-center py-8 text-sm text-destructive">
              Audit failed. Click "Run Audit" to retry.
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Click "Run Audit" to scan rebar.shop for speed issues.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
