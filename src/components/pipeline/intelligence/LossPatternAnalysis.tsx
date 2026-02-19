import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingDown, AlertTriangle, Target, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { differenceInCalendarDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
}

export function LossPatternAnalysis({ leads }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lostLeads = leads.filter(l => l.stage === "lost" || l.stage === "loss");
  const wonLeads = leads.filter(l => l.stage === "won");

  // Pre-compute local patterns
  const lossStats = (() => {
    if (lostLeads.length === 0) return null;

    // Average cycle time for lost vs won
    const lostCycles = lostLeads.map(l => differenceInCalendarDays(new Date(l.updated_at), new Date(l.created_at))).filter(d => d > 0);
    const wonCycles = wonLeads.map(l => differenceInCalendarDays(new Date(l.updated_at), new Date(l.created_at))).filter(d => d > 0);
    const avgLostCycle = lostCycles.length > 0 ? Math.round(lostCycles.reduce((a, b) => a + b, 0) / lostCycles.length) : 0;
    const avgWonCycle = wonCycles.length > 0 ? Math.round(wonCycles.reduce((a, b) => a + b, 0) / wonCycles.length) : 0;

    // Value comparison
    const avgLostValue = lostLeads.length > 0 ? Math.round(lostLeads.reduce((s, l) => s + ((l.expected_value as number) || 0), 0) / lostLeads.length) : 0;
    const avgWonValue = wonLeads.length > 0 ? Math.round(wonLeads.reduce((s, l) => s + ((l.expected_value as number) || 0), 0) / wonLeads.length) : 0;

    // Source analysis
    const lostBySrc: Record<string, number> = {};
    lostLeads.forEach(l => {
      const src = (l as any).source || "unknown";
      lostBySrc[src] = (lostBySrc[src] || 0) + 1;
    });

    const totalLostValue = lostLeads.reduce((s, l) => s + ((l.expected_value as number) || 0), 0);

    return {
      totalLost: lostLeads.length,
      totalWon: wonLeads.length,
      avgLostCycle,
      avgWonCycle,
      avgLostValue,
      avgWonValue,
      totalLostValue,
      topLostSources: Object.entries(lostBySrc).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  })();

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const lostSample = lostLeads.slice(0, 50).map(l => ({
        title: l.title,
        value: l.expected_value || 0,
        probability: l.probability,
        win_score: l.win_prob_score,
        cycle_days: differenceInCalendarDays(new Date(l.updated_at), new Date(l.created_at)),
        source: (l as any).source || "unknown",
      }));

      const { data, error: fnError } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          action: "pipeline_audit",
          auditType: "custom_question",
          userMessage: `Analyze these ${lostLeads.length} lost deals and identify systemic loss patterns. Here's a sample of lost deals:\n\n${JSON.stringify(lostSample, null, 2)}\n\nSummary stats:\n- Total lost: ${lossStats?.totalLost}\n- Avg lost deal cycle: ${lossStats?.avgLostCycle} days (vs ${lossStats?.avgWonCycle} days for won)\n- Avg lost deal value: $${lossStats?.avgLostValue} (vs $${lossStats?.avgWonValue} for won)\n- Total lost revenue: $${lossStats?.totalLostValue?.toLocaleString()}\n\nProvide:\n1. Top 3-5 systemic loss patterns (with % of losses each represents)\n2. Early warning signals that predict a loss\n3. Specific, actionable recommendations to reduce loss rate\n4. Which deal characteristics correlate most with losses vs wins`,
          pipelineStats: {
            totalLost: lostLeads.length,
            totalWon: wonLeads.length,
            lostSample,
          },
        },
      });

      if (fnError) throw fnError;
      setAnalysis(data?.answer || "Unable to generate analysis.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      {lossStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Lost Deals</span>
              </div>
              <p className="text-lg font-bold text-destructive">{lossStats.totalLost}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Lost Revenue</span>
              </div>
              <p className="text-lg font-bold">${lossStats.totalLostValue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Lost Cycle</span>
              </div>
              <p className="text-lg font-bold">{lossStats.avgLostCycle}d <span className="text-xs text-muted-foreground">vs {lossStats.avgWonCycle}d won</span></p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Lost Value</span>
              </div>
              <p className="text-lg font-bold">${lossStats.avgLostValue.toLocaleString()} <span className="text-xs text-muted-foreground">vs ${lossStats.avgWonValue.toLocaleString()}</span></p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Loss Sources */}
      {lossStats && lossStats.topLostSources.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Loss Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lossStats.topLostSources.map(([src, count]) => (
                <Badge key={src} variant="outline" className="text-xs">
                  {src}: {count} ({Math.round((count / lossStats.totalLost) * 100)}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      <Card className="border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500" /> AI Loss Pattern Analysis
          </CardTitle>
          <Button size="sm" variant="outline" onClick={generateAnalysis} disabled={loading || lostLeads.length === 0} className="gap-1.5 h-7 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Analyze
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs py-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
          {analysis ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed whitespace-pre-wrap">
              {analysis}
            </div>
          ) : !loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {lostLeads.length === 0
                ? "No lost deals found to analyze."
                : `Click "Analyze" to identify patterns across ${lostLeads.length} lost deals.`}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing {lostLeads.length} lost deals...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
