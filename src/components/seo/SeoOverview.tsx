import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, AlertTriangle, Activity, Zap, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function SeoOverview() {
  const qc = useQueryClient();

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // AI keyword stats
  const { data: kwStats } = useQuery({
    queryKey: ["seo-ai-kw-stats", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_keyword_ai")
        .select("opportunity_score, status, impressions_28d, clicks_28d")
        .eq("domain_id", domain!.id);
      const all = data || [];
      const totalImpressions = all.reduce((s: number, k: any) => s + (k.impressions_28d || 0), 0);
      const totalClicks = all.reduce((s: number, k: any) => s + (k.clicks_28d || 0), 0);
      const winners = all.filter((k: any) => k.status === "winner").length;
      const declining = all.filter((k: any) => k.status === "declining").length;
      return { total: all.length, totalImpressions, totalClicks, winners, declining };
    },
  });

  // AI page stats
  const { data: pgStats } = useQuery({
    queryKey: ["seo-ai-pg-stats", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_page_ai")
        .select("sessions, conversions, revenue, seo_score")
        .eq("domain_id", domain!.id);
      const all = data || [];
      const totalSessions = all.reduce((s: number, p: any) => s + (p.sessions || 0), 0);
      const totalConversions = all.reduce((s: number, p: any) => s + (p.conversions || 0), 0);
      const totalRevenue = all.reduce((s: number, p: any) => s + Number(p.revenue || 0), 0);
      const avgScore = all.length ? all.reduce((s: number, p: any) => s + Number(p.seo_score || 0), 0) / all.length : 0;
      return { total: all.length, totalSessions, totalConversions, totalRevenue, avgScore: Math.round(avgScore) };
    },
  });

  // Top insights
  const { data: insights } = useQuery({
    queryKey: ["seo-ai-insights", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_insight")
        .select("*")
        .eq("domain_id", domain!.id)
        .order("confidence_score", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  // Open tasks count
  const { data: taskStats } = useQuery({
    queryKey: ["seo-ai-task-stats", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("seo_tasks")
        .select("*", { count: "exact", head: true })
        .eq("domain_id", domain!.id)
        .eq("status", "open");
      return { open: count || 0 };
    },
  });

  // Run AI Analysis
  const runAnalysis = useMutation({
    mutationFn: async () => {
      if (!domain?.id) throw new Error("No domain configured");
      const { data, error } = await supabase.functions.invoke("seo-ai-analyze", {
        body: { domain_id: domain.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-ai"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-pg-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-insights"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-task-stats"] });
      toast.success(`AI Analysis complete: ${data.ai_keywords_updated} keywords, ${data.insights_created} insights, ${data.tasks_created} tasks`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Sync GSC
  const syncGsc = useMutation({
    mutationFn: async () => {
      if (!domain?.id) throw new Error("No domain");
      const { data, error } = await supabase.functions.invoke("seo-gsc-sync", {
        body: { domain_id: domain.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      toast.success(`GSC synced: ${data.rows_processed} rows`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const insightTypeIcon: Record<string, { color: string; label: string }> = {
    opportunity: { color: "text-green-600 bg-green-500/10", label: "Opportunity" },
    risk: { color: "text-destructive bg-destructive/10", label: "Risk" },
    win: { color: "text-primary bg-primary/10", label: "Win" },
    action: { color: "text-yellow-600 bg-yellow-500/10", label: "Action" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI SEO Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">AI-curated insights from Google Search Console + Analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncGsc.mutate()} disabled={syncGsc.isPending || !domain}>
            {syncGsc.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Sync GSC
          </Button>
          <Button size="sm" onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending || !domain}>
            {runAnalysis.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Run AI Analysis
          </Button>
        </div>
      </div>

      {!domain && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No domain configured. Set up a domain to begin AI SEO analysis.
          </CardContent>
        </Card>
      )}

      {domain && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{pgStats?.avgScore ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Avg SEO Score</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Search className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{kwStats?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Keywords Tracked</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{kwStats?.totalClicks?.toLocaleString() ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Organic Clicks (28d)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{kwStats?.declining ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Declining Keywords</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{taskStats?.open ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Open AI Tasks</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Top AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!insights?.length ? (
                <p className="text-sm text-muted-foreground">No insights yet. Run an AI analysis to generate insights.</p>
              ) : (
                <div className="space-y-3">
                  {insights.map((ins: any) => {
                    const meta = insightTypeIcon[ins.insight_type] || insightTypeIcon.action;
                    return (
                      <div key={ins.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        <Badge className={`text-[10px] shrink-0 ${meta.color}`}>{meta.label}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{ins.explanation_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Confidence: {Math.round((ins.confidence_score || 0) * 100)}% · {ins.entity_type}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue from organic */}
          {pgStats && pgStats.totalRevenue > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{pgStats.totalSessions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Organic Sessions (28d)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{pgStats.totalConversions}</p>
                  <p className="text-xs text-muted-foreground">Conversions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">${pgStats.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenue from Organic</p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
