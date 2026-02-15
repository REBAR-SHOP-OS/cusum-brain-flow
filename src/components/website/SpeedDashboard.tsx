import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Zap, AlertTriangle, CheckCircle, RefreshCw, Gauge, Image, Server, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SERVER_HEALTH_ITEMS = [
  { id: "autoload", severity: "critical" as const, title: "Autoloaded Options Bloat", description: "Autoloaded data is 1.1 MB. Install Advanced Database Cleaner or WP-Optimize to purge stale transients and expired options. Target: under 800 KB." },
  { id: "redis", severity: "critical" as const, title: "No Persistent Object Cache", description: "No Redis/Memcached detected. Enable persistent object caching via your hosting panel (most managed hosts offer one-click Redis). This eliminates redundant database queries on every page load." },
  { id: "consent", severity: "warning" as const, title: "Consent API Non-Compliance", description: "One or more plugins don't declare cookie consent via the WP Consent API. Update CookieYes/cookie plugins or replace with a Consent API-compatible alternative." },
];

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

interface MediaAuditItem {
  id: number;
  title: string;
  source_url: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  issues: string[];
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
  media_audit: MediaAuditItem[];
  media_audit_count: number;
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
  const [checkedHealth, setCheckedHealth] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("speed-health-checklist") || "[]"); } catch { return []; }
  });

  const toggleHealthItem = (id: string) => {
    setCheckedHealth(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("speed-health-checklist", JSON.stringify(next));
      return next;
    });
  };

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
                  Adds lazy loading, decoding, fetchpriority, and width/height dimensions to all images.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setOptimizerMode("dry_run"); optimizerMutation.mutate(true); }}
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

              {/* Media Library Audit Results */}
              {optimizerMutation.data?.media_audit && optimizerMutation.data.media_audit.length > 0 && (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <h3 className="text-sm font-semibold">Media Library: {optimizerMutation.data.media_audit_count} Oversized Images</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These images need server-side compression (ShortPixel/Imagify plugin required).
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {optimizerMutation.data.media_audit.slice(0, 20).map((item) => (
                      <div key={item.id} className="text-xs bg-muted rounded p-1.5">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-muted-foreground ml-1">({item.mime_type})</span>
                        {item.width && item.height && (
                          <span className="text-muted-foreground ml-1">{item.width}×{item.height}</span>
                        )}
                        {item.file_size_bytes && (
                          <span className="text-muted-foreground ml-1">{(item.file_size_bytes / 1024).toFixed(0)} KB</span>
                        )}
                        <ul className="mt-0.5 text-muted-foreground">
                          {item.issues.map((issue, i) => <li key={i}>• {issue}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

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

              {/* WordPress Health Checklist */}
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">WordPress Health Checklist</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Server-side issues from Site Health report. Check off as you resolve them.
                </p>
                <div className="space-y-2">
                  {SERVER_HEALTH_ITEMS.map(item => (
                    <label key={item.id} className={cn("flex items-start gap-2 p-2 rounded cursor-pointer transition-colors", checkedHealth.includes(item.id) ? "bg-muted/50 opacity-60" : "hover:bg-muted/30")}>
                      <Checkbox
                        checked={checkedHealth.includes(item.id)}
                        onCheckedChange={() => toggleHealthItem(item.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-medium", checkedHealth.includes(item.id) && "line-through")}>{item.title}</span>
                          <Badge variant={item.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">{item.severity}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </Card>

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
