import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface Props {
  leads: LeadWithCustomer[];
}

export function LeadScoringInsights({ leads }: Props) {
  const scored = useMemo(() =>
    leads.filter(l => (l.win_prob_score as number) > 0),
    [leads]
  );

  const stats = useMemo(() => {
    if (scored.length === 0) return null;
    const probs = scored.map(l => l.win_prob_score as number);
    const avg = probs.reduce((s, p) => s + p, 0) / probs.length;
    const high = scored.filter(l => (l.win_prob_score as number) >= 60).length;
    const low = scored.filter(l => (l.win_prob_score as number) < 30).length;
    const topLeads = [...scored].sort((a, b) => (b.win_prob_score as number) - (a.win_prob_score as number)).slice(0, 5);
    const riskLeads = [...scored].sort((a, b) => (a.win_prob_score as number) - (b.win_prob_score as number)).slice(0, 5);
    return { avg: Math.round(avg), high, low, total: scored.length, topLeads, riskLeads };
  }, [scored]);

  if (!stats) {
    return (
      <Card className="border-border">
        <CardContent className="p-6 text-center">
          <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No scored leads found. Run scoring to see insights.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Brain className="w-4 h-4 text-primary" /> Scoring Distribution
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Scored</p>
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Avg Win %</p>
            <p className="text-lg font-bold text-foreground">{stats.avg}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">High (≥60%)</p>
            <p className="text-lg font-bold text-emerald-600">{stats.high}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">At Risk (&lt;30%)</p>
            <p className="text-lg font-bold text-destructive">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top leads */}
        <Card className="border-border">
          <CardContent className="p-3">
            <h4 className="text-xs font-semibold flex items-center gap-1 mb-2">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Top Leads
            </h4>
            <div className="space-y-1.5">
              {stats.topLeads.map(l => (
                <div key={l.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate flex-1 text-foreground">{l.title}</span>
                  <Badge variant="secondary" className="text-[9px] ml-2">
                    {Math.round(l.win_prob_score as number)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk leads */}
        <Card className="border-border">
          <CardContent className="p-3">
            <h4 className="text-xs font-semibold flex items-center gap-1 mb-2">
              <AlertTriangle className="w-3 h-3 text-destructive" /> At Risk
            </h4>
            <div className="space-y-1.5">
              {stats.riskLeads.map(l => (
                <div key={l.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate flex-1 text-foreground">{l.title}</span>
                  <Badge variant="destructive" className="text-[9px] ml-2">
                    {Math.round(l.win_prob_score as number)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
