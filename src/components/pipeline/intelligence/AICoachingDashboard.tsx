import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Target, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface Props {
  leads: LeadWithCustomer[];
  isLoading?: boolean;
}

interface CoachingInsight {
  lead_id: string;
  lead_title: string;
  action_type: string;
  headline: string;
  reasoning: string;
  urgency: string;
  confidence: number;
  win_probability?: number;
}

const URGENCY_COLORS: Record<string, string> = {
  now: "bg-destructive text-destructive-foreground",
  today: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  this_week: "bg-primary/10 text-primary",
  next_week: "bg-muted text-muted-foreground",
};

const ACTION_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  stage_move: "➡️",
  follow_up: "🔄",
  escalate: "🚨",
  close_deal: "🏆",
  data_fix: "🔧",
};

export function AICoachingDashboard({ leads, isLoading }: Props) {
  const [insights, setInsights] = useState<CoachingInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Get top leads by value that aren't terminal
  const TERMINAL = new Set(["won", "lost", "loss", "merged", "archived_orphan"]);
  const activeLeads = useMemo(() =>
    leads
      .filter(l => !TERMINAL.has(l.stage))
      .sort((a, b) => ((b.expected_value as number) || 0) - ((a.expected_value as number) || 0))
      .slice(0, 20),
    [leads]
  );

  const runCoaching = async () => {
    if (activeLeads.length === 0) {
      toast.error("No active leads to analyze");
      return;
    }
    setLoading(true);
    const results: CoachingInsight[] = [];

    // Process top 10 leads in parallel batches of 5
    const batch = activeLeads.slice(0, 10);
    const promises = batch.map(async (lead) => {
      try {
        const { data, error } = await supabase.functions.invoke("pipeline-ai", {
          body: {
            action: "next_best_action",
            lead: {
              ...lead,
              customer_name: lead.customers?.name || lead.customers?.company_name || "",
            },
          },
        });
        if (error) throw error;
        return {
          lead_id: lead.id,
          lead_title: lead.title,
          action_type: data.action_type || "follow_up",
          headline: data.headline || "Follow up",
          reasoning: data.reasoning || "",
          urgency: data.urgency || "this_week",
          confidence: data.confidence || 50,
          win_probability: lead.win_prob_score ?? undefined,
        } as CoachingInsight;
      } catch (e) {
        console.warn(`Coaching failed for ${lead.title}:`, e);
        return null;
      }
    });

    const settled = await Promise.all(promises);
    settled.forEach(r => { if (r) results.push(r); });

    // Sort by urgency then confidence
    const urgencyOrder: Record<string, number> = { now: 0, today: 1, this_week: 2, next_week: 3 };
    results.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3) || b.confidence - a.confidence);

    setInsights(results);
    setLastRun(new Date());
    setLoading(false);
    toast.success(`Generated ${results.length} coaching insights`);
  };

  const avgConfidence = insights.length > 0
    ? Math.round(insights.reduce((s, i) => s + i.confidence, 0) / insights.length)
    : 0;
  const criticalCount = insights.filter(i => i.urgency === "now" || i.urgency === "today").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> AI Coaching & Recommendations
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            AI-powered next-best-action for your top {Math.min(activeLeads.length, 10)} active leads
          </p>
        </div>
        <Button size="sm" onClick={runCoaching} disabled={loading || isLoading} className="gap-1.5 h-8 text-xs">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {loading ? "Analyzing..." : "Run AI Coaching"}
        </Button>
      </div>

      {/* Summary cards */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Insights</p>
              <p className="text-lg font-bold text-foreground">{insights.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Urgent</p>
              <p className="text-lg font-bold text-destructive">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Avg Confidence</p>
              <p className="text-lg font-bold text-foreground">{avgConfidence}%</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Last Run</p>
              <p className="text-xs font-medium text-foreground">{lastRun ? lastRun.toLocaleTimeString() : "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights list */}
      {insights.length === 0 && !loading && (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click "Run AI Coaching" to generate personalized recommendations</p>
            <p className="text-[11px] text-muted-foreground mt-1">Analyzes your top {Math.min(activeLeads.length, 10)} leads by value</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Analyzing leads with AI...</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <Card key={insight.lead_id} className="border-border hover:bg-muted/20 transition-colors">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <span className="text-lg">{ACTION_ICONS[insight.action_type] || "💡"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-foreground truncate">{insight.lead_title}</span>
                    <Badge className={cn("text-[9px] px-1.5 py-0", URGENCY_COLORS[insight.urgency] || URGENCY_COLORS.this_week)}>
                      {insight.urgency.replace("_", " ")}
                    </Badge>
                    {insight.win_probability != null && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> {insight.win_probability}% win
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground">{insight.headline}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{insight.reasoning}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">Confidence</p>
                  <p className={cn("text-sm font-bold", insight.confidence >= 70 ? "text-green-600" : insight.confidence >= 40 ? "text-yellow-600" : "text-red-500")}>
                    {insight.confidence}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
