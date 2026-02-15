import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Search, AlertTriangle, FileText, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function SeoOverview() {
  // Latest crawl run for health score
  const { data: latestCrawl } = useQuery({
    queryKey: ["seo-latest-crawl"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_crawl_runs")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Health score trend (last 10 crawls)
  const { data: healthTrend } = useQuery({
    queryKey: ["seo-health-trend"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_crawl_runs")
        .select("health_score, completed_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: true })
        .limit(10);
      return (data || []).map((r: any) => ({
        date: r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "",
        score: r.health_score,
      }));
    },
  });

  // Total keywords tracked
  const { data: keywordStats } = useQuery({
    queryKey: ["seo-keyword-stats"],
    queryFn: async () => {
      const { count } = await supabase
        .from("seo_keywords")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      return { total: count || 0 };
    },
  });

  // Top movers (biggest position changes in last 7 days)
  const { data: movers } = useQuery({
    queryKey: ["seo-movers"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from("seo_rank_history")
        .select("keyword_id, date, position, seo_keywords!inner(keyword)")
        .gte("date", sevenDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(500);

      if (!data?.length) return { winners: [], losers: [] };

      // Group by keyword_id, compute delta
      const byKeyword = new Map<string, { keyword: string; positions: { date: string; position: number }[] }>();
      for (const row of data) {
        const kId = row.keyword_id;
        if (!byKeyword.has(kId)) {
          byKeyword.set(kId, { keyword: (row as any).seo_keywords?.keyword || kId, positions: [] });
        }
        if (row.position) byKeyword.get(kId)!.positions.push({ date: row.date, position: Number(row.position) });
      }

      const deltas: { keyword: string; delta: number; current: number }[] = [];
      for (const [, val] of byKeyword) {
        if (val.positions.length < 2) continue;
        const sorted = val.positions.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0].position;
        const last = sorted[sorted.length - 1].position;
        deltas.push({ keyword: val.keyword, delta: first - last, current: last }); // positive = improved
      }

      deltas.sort((a, b) => b.delta - a.delta);
      return {
        winners: deltas.filter((d) => d.delta > 0).slice(0, 5),
        losers: deltas.filter((d) => d.delta < 0).slice(0, 5),
      };
    },
  });

  // Issues summary from latest crawl
  const { data: issuesSummary } = useQuery({
    queryKey: ["seo-issues-summary", latestCrawl?.id],
    enabled: !!latestCrawl?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_issues")
        .select("severity")
        .eq("crawl_run_id", latestCrawl!.id);
      const counts = { critical: 0, warning: 0, info: 0 };
      for (const i of data || []) {
        if (i.severity in counts) counts[i.severity as keyof typeof counts]++;
      }
      return counts;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO Overview</h1>
        <p className="text-sm text-muted-foreground">Health scores, keyword movements, and audit summary</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{latestCrawl?.health_score ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Health Score</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Search className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{keywordStats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Keywords Tracked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{latestCrawl?.pages_crawled ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pages Crawled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{issuesSummary?.critical ?? 0}</p>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score Trend */}
      {healthTrend && healthTrend.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Health Score Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={healthTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Winners & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Top Winners</CardTitle></CardHeader>
          <CardContent>
            {movers?.winners?.length ? (
              <div className="space-y-2">
                {movers.winners.map((w, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="truncate">{w.keyword}</span>
                    <Badge variant="outline" className="text-green-600">↑ {w.delta} → #{w.current}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet. Sync GSC or run rank checks.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Top Losers</CardTitle></CardHeader>
          <CardContent>
            {movers?.losers?.length ? (
              <div className="space-y-2">
                {movers.losers.map((l, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="truncate">{l.keyword}</span>
                    <Badge variant="outline" className="text-red-600">↓ {Math.abs(l.delta)} → #{l.current}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issues by severity */}
      {issuesSummary && (
        <Card>
          <CardHeader><CardTitle className="text-base">Issues by Severity</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{issuesSummary.critical}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{issuesSummary.warning}</p>
                <p className="text-xs text-muted-foreground">Warning</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{issuesSummary.info}</p>
                <p className="text-xs text-muted-foreground">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
