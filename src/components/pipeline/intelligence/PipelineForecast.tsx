import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, DollarSign, Target, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { differenceInCalendarDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
  outcomes: any[];
  isLoading: boolean;
}

interface ForecastResult {
  best_case: number;
  likely_case: number;
  worst_case: number;
  monthly_projection: { month: string; revenue: number }[];
  risks: string[];
  opportunities: string[];
  confidence: number;
  summary: string;
}

const TERMINAL_STAGES = new Set(["won", "lost", "loss", "merged", "archived_orphan", "no_rebars_out_of_scope", "dreamers", "migration_others"]);

export function PipelineForecast({ leads, outcomes, isLoading: leadsLoading }: Props) {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local weighted forecast as baseline
  const localForecast = useMemo(() => {
    const active = leads.filter(l => !TERMINAL_STAGES.has(l.stage));
    const bestCase = active.reduce((s, l) => s + ((l.expected_value as number) || 0), 0);
    const weighted = active.reduce((s, l) => s + (((l.expected_value as number) || 0) * ((l.probability as number) ?? 50)) / 100, 0);
    const worstCase = active.reduce((s, l) => {
      const prob = (l.probability as number) ?? 50;
      return s + (((l.expected_value as number) || 0) * Math.max(prob - 20, 5)) / 100;
    }, 0);

    // Historical win rate from outcomes
    const wonOutcomes = outcomes.filter(o => o.outcome === "won").length;
    const totalOutcomes = outcomes.length;
    const historicalWinRate = totalOutcomes > 0 ? Math.round((wonOutcomes / totalOutcomes) * 100) : 0;

    // Stage velocity
    const wonLeads = leads.filter(l => l.stage === "won");
    const cycleTimes = wonLeads.map(l => differenceInCalendarDays(new Date(l.updated_at), new Date(l.created_at))).filter(d => d > 0);
    const avgCycle = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : 0;

    return { bestCase, weighted, worstCase, historicalWinRate, avgCycle, activeCount: active.length };
  }, [leads, outcomes]);

  const generateAIForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const active = leads.filter(l => !TERMINAL_STAGES.has(l.stage));
      const stageBreakdown = PIPELINE_STAGES.map(s => {
        const stageLeads = active.filter(l => l.stage === s.id);
        return { stage: s.label, count: stageLeads.length, value: stageLeads.reduce((sum, l) => sum + ((l.expected_value as number) || 0), 0) };
      }).filter(s => s.count > 0);

      const { data, error: fnError } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          action: "pipeline_audit",
          auditType: "revenue_forecast",
          pipelineStats: {
            totalActive: active.length,
            totalValue: localForecast.bestCase,
            weightedValue: localForecast.weighted,
            historicalWinRate: localForecast.historicalWinRate,
            avgCycleDays: localForecast.avgCycle,
            stageBreakdown,
            wonCount: leads.filter(l => l.stage === "won").length,
            lostCount: leads.filter(l => l.stage === "lost" || l.stage === "loss").length,
          },
        },
      });

      if (fnError) throw fnError;

      // Parse the AI response
      const answer = data?.answer || "";
      setForecast({
        best_case: localForecast.bestCase,
        likely_case: localForecast.weighted,
        worst_case: localForecast.worstCase,
        monthly_projection: [],
        risks: [],
        opportunities: [],
        confidence: localForecast.historicalWinRate > 0 ? Math.min(localForecast.historicalWinRate + 10, 90) : 50,
        summary: answer,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  };

  // Scenario chart data
  const scenarioData = [
    { scenario: "Worst Case", revenue: Math.round(localForecast.worstCase) },
    { scenario: "Likely", revenue: Math.round(localForecast.weighted) },
    { scenario: "Best Case", revenue: Math.round(localForecast.bestCase) },
  ];

  return (
    <div className="space-y-6">
      {/* Forecast Scenarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Worst Case</span>
            <p className="text-xl font-bold text-amber-500">${Math.round(localForecast.worstCase).toLocaleString()}</p>
            <span className="text-[10px] text-muted-foreground">Conservative estimate</span>
          </CardContent>
        </Card>
        <Card className="border-border border-l-4 border-l-primary">
          <CardContent className="p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Likely Case</span>
            <p className="text-xl font-bold text-primary">${Math.round(localForecast.weighted).toLocaleString()}</p>
            <span className="text-[10px] text-muted-foreground">Weighted by probability</span>
          </CardContent>
        </Card>
        <Card className="border-border border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Case</span>
            <p className="text-xl font-bold text-emerald-500">${Math.round(localForecast.bestCase).toLocaleString()}</p>
            <span className="text-[10px] text-muted-foreground">All deals close</span>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <Target className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{localForecast.activeCount}</p>
            <span className="text-[10px] text-muted-foreground">Active Deals</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{localForecast.historicalWinRate}%</p>
            <span className="text-[10px] text-muted-foreground">Historical Win Rate</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{localForecast.avgCycle}d</p>
            <span className="text-[10px] text-muted-foreground">Avg Cycle Time</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <Sparkles className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{forecast?.confidence || "—"}%</p>
            <span className="text-[10px] text-muted-foreground">Forecast Confidence</span>
          </CardContent>
        </Card>
      </div>

      {/* Scenario Chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revenue Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scenarioData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="scenario" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* AI Deep Forecast */}
      <Card className="border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500" /> AI Revenue Forecast
          </CardTitle>
          <Button size="sm" variant="outline" onClick={generateAIForecast} disabled={loading} className="gap-1.5 h-7 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Generate
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs py-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
          {forecast?.summary ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed whitespace-pre-wrap">
              {forecast.summary}
            </div>
          ) : !loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Click "Generate" to get an AI-powered revenue forecast with insights and recommendations.
            </p>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing pipeline data...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
