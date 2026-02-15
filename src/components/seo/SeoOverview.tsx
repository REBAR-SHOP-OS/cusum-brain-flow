import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Search, AlertTriangle, Activity, Zap, Loader2, Sparkles, Layers, Globe, Link2, CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

const SOURCE_COLORS: Record<string, string> = {
  gsc: "bg-blue-500/10 text-blue-600",
  social: "bg-pink-500/10 text-pink-600",
  email: "bg-amber-500/10 text-amber-600",
  leads: "bg-green-500/10 text-green-600",
  quotes: "bg-purple-500/10 text-purple-600",
  orders: "bg-cyan-500/10 text-cyan-600",
  knowledge: "bg-orange-500/10 text-orange-600",
  wordpress: "bg-indigo-500/10 text-indigo-600",
  prospects: "bg-rose-500/10 text-rose-600",
  seo_tools: "bg-emerald-500/10 text-emerald-600",
};

export function SeoOverview() {
  const qc = useQueryClient();
  const { companyId } = useCompanyId();
  const [domainInput, setDomainInput] = useState("rebar.shop");
  const [gaInput, setGaInput] = useState("");
  const [googleStatus, setGoogleStatus] = useState<"checking" | "connected" | "not_connected">("checking");
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Check Google connection status
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke("google-oauth", {
          body: { action: "check-status", integration: "google-search-console" },
        });
        if (data?.status === "connected") {
          setGoogleStatus("connected");
          setGoogleEmail(data.email || null);
        } else {
          setGoogleStatus("not_connected");
        }
      } catch {
        setGoogleStatus("not_connected");
      }
    };
    check();
  }, []);

  const connectGoogle = async () => {
    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        body: { action: "get-auth-url", integration: "google-search-console", redirectUri },
      });
      if (error) throw error;
      if (data?.authUrl) window.location.href = data.authUrl;
    } catch (e: any) {
      toast.error(e.message || "Failed to start Google OAuth");
    }
  };

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: kwStats } = useQuery({
    queryKey: ["seo-ai-kw-stats", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_keyword_ai")
        .select("opportunity_score, status, impressions_28d, clicks_28d, sources, source_count")
        .eq("domain_id", domain!.id);
      const all = data || [];
      const totalImpressions = all.reduce((s: number, k: any) => s + (k.impressions_28d || 0), 0);
      const totalClicks = all.reduce((s: number, k: any) => s + (k.clicks_28d || 0), 0);
      const winners = all.filter((k: any) => k.status === "winner").length;
      const declining = all.filter((k: any) => k.status === "declining").length;
      const crossValidated = all.filter((k: any) => (k.source_count || 0) >= 3).length;

      // Source distribution
      const sourceCounts: Record<string, number> = {};
      for (const k of all) {
        for (const src of (k.sources || [])) {
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        }
      }

      return { total: all.length, totalImpressions, totalClicks, winners, declining, crossValidated, sourceCounts };
    },
  });

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

  const mineReports = useMutation({
    mutationFn: async () => {
      if (!domain?.id) throw new Error("No domain configured");
      const { data, error } = await supabase.functions.invoke("seo-email-harvest", {
        body: { domain_id: domain.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-insights"] });
      toast.success(`Mined ${data.emails_parsed} reports: ${data.keywords_extracted} keywords, ${data.issues_found} issues extracted`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setupDomain = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("seo_domains").insert({
        domain: domainInput.trim(),
        ga_property_id: gaInput.trim() || null,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-domain"] });
      toast.success(`Domain "${domainInput}" configured successfully`);
    },
    onError: (e: any) => toast.error(e.message),
  });

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

  const sortedSources = Object.entries(kwStats?.sourceCounts || {}).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI SEO Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">AI-curated insights from GSC + Analytics + ERP Sources</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncGsc.mutate()} disabled={syncGsc.isPending || !domain || googleStatus !== "connected"}>
            {syncGsc.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Sync GSC
          </Button>
          <Button variant="outline" size="sm" onClick={() => mineReports.mutate()} disabled={mineReports.isPending || !domain}>
            {mineReports.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            Mine SEO Reports
          </Button>
          <Button size="sm" onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending || !domain}>
            {runAnalysis.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Run AI Analysis
          </Button>
        </div>
      </div>

      {!domain && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Set Up Your Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input id="domain" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga">GA4 Property ID (optional)</Label>
              <Input id="ga" value={gaInput} onChange={(e) => setGaInput(e.target.value)} placeholder="properties/123456789" />
            </div>
            <Button
              onClick={() => {
                if (!domainInput.trim() || !companyId) {
                  toast.error("Domain name and company are required");
                  return;
                }
                setupDomain.mutate();
              }}
              disabled={setupDomain.isPending || !companyId}
            >
              {setupDomain.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
              Set Up Domain
            </Button>
          </CardContent>
        </Card>
      )}

      {domain && (
        <>
          {/* Google Connection Status */}
          <Card className={googleStatus === "connected" ? "border-green-500/30" : "border-yellow-500/30"}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {googleStatus === "connected" ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Google connected as <strong>{googleEmail}</strong> — GSC & GA4 data active</span>
                  </>
                ) : googleStatus === "checking" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking Google connection...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">Google not connected — running ERP-only keyword harvest</span>
                  </>
                )}
              </div>
              {googleStatus === "not_connected" && (
                <Button size="sm" variant="outline" onClick={connectGoogle}>
                  <Link2 className="w-4 h-4 mr-1" /> Connect Google
                </Button>
              )}
            </CardContent>
          </Card>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                <Layers className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{kwStats?.crossValidated ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Cross-validated (3+)</p>
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

          {/* Keyword Source Distribution */}
          {sortedSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Keyword Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {sortedSources.map(([src, count]) => (
                    <div key={src} className="flex items-center gap-2">
                      <Badge className={`text-xs ${SOURCE_COLORS[src] || "bg-muted text-muted-foreground"}`}>
                        {src}
                      </Badge>
                      <span className="text-sm font-mono font-medium">{count}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Keywords sourced from {sortedSources.length} channels across your ERP
                </p>
              </CardContent>
            </Card>
          )}

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
