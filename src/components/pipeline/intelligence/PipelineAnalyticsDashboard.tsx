import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Target, BarChart3, Clock, ArrowRight, Trophy, XCircle } from "lucide-react";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { differenceInCalendarDays, subDays, format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
  outcomes: any[];
  isLoading: boolean;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function PipelineAnalyticsDashboard({ leads, outcomes, isLoading }: Props) {
  const stats = useMemo(() => {
    const total = leads.length;
    const totalValue = leads.reduce((sum, l) => sum + ((l.expected_value as number) || 0), 0);
    const wonLeads = leads.filter(l => l.stage === "won");
    const lostLeads = leads.filter(l => l.stage === "lost" || l.stage === "loss");
    const activeLeads = leads.filter(l => l.stage !== "won" && l.stage !== "lost" && l.stage !== "loss" && l.stage !== "merged");
    const wonValue = wonLeads.reduce((sum, l) => sum + ((l.expected_value as number) || 0), 0);
    const closedLeads = wonLeads.length + lostLeads.length;
    const winRate = closedLeads > 0 ? Math.round((wonLeads.length / closedLeads) * 100) : 0;
    const avgDealSize = wonLeads.length > 0 ? Math.round(wonValue / wonLeads.length) : 0;
    const weightedValue = activeLeads.reduce((sum, l) => sum + (((l.expected_value as number) || 0) * ((l.probability as number) ?? 50)) / 100, 0);

    // Avg cycle time (won leads)
    const cycleTimes = wonLeads.map(l => differenceInCalendarDays(new Date(l.updated_at), new Date(l.created_at))).filter(d => d > 0);
    const avgCycleTime = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : 0;

    return { total, totalValue, wonLeads: wonLeads.length, lostLeads: lostLeads.length, activeLeads: activeLeads.length, wonValue, winRate, avgDealSize, weightedValue, avgCycleTime };
  }, [leads]);

  // Stage funnel
  const funnelData = useMemo(() => {
    const activeStages = PIPELINE_STAGES.filter(s => !["won", "lost", "loss", "merged", "archived_orphan", "no_rebars_out_of_scope", "dreamers", "migration_others", "temp_ir_vam"].includes(s.id));
    return activeStages.map(stage => {
      const stageLeads = leads.filter(l => l.stage === stage.id);
      return {
        name: stage.label.length > 16 ? stage.label.slice(0, 14) + "…" : stage.label,
        count: stageLeads.length,
        value: stageLeads.reduce((s, l) => s + ((l.expected_value as number) || 0), 0),
      };
    }).filter(s => s.count > 0);
  }, [leads]);

  // Win/Loss pie
  const winLossData = useMemo(() => [
    { name: "Won", value: stats.wonLeads },
    { name: "Lost", value: stats.lostLeads },
    { name: "Active", value: stats.activeLeads },
  ].filter(d => d.value > 0), [stats]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 5), end: startOfMonth(now) });
    return months.map(month => {
      const monthEnd = endOfMonth(month);
      const created = leads.filter(l => {
        const d = new Date(l.created_at);
        return d >= month && d <= monthEnd;
      }).length;
      const won = leads.filter(l => {
        if (l.stage !== "won") return false;
        const d = new Date(l.updated_at);
        return d >= month && d <= monthEnd;
      }).length;
      return { month: format(month, "MMM"), created, won };
    });
  }, [leads]);

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Pipeline Value", value: `$${stats.totalValue.toLocaleString()}`, icon: DollarSign, accent: "text-primary" },
          { label: "Weighted Forecast", value: `$${Math.round(stats.weightedValue).toLocaleString()}`, icon: Target, accent: "text-emerald-500" },
          { label: "Win Rate", value: `${stats.winRate}%`, icon: Trophy, accent: "text-amber-500" },
          { label: "Won Revenue", value: `$${stats.wonValue.toLocaleString()}`, icon: TrendingUp, accent: "text-emerald-500" },
          { label: "Avg Deal Size", value: `$${stats.avgDealSize.toLocaleString()}`, icon: BarChart3, accent: "text-blue-500" },
          { label: "Avg Cycle", value: `${stats.avgCycleTime}d`, icon: Clock, accent: "text-muted-foreground" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={cn("w-3.5 h-3.5", kpi.accent)} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><ArrowRight className="w-4 h-4" /> Stage Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Win/Loss Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Target className="w-4 h-4" /> Win/Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={winLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {winLossData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Monthly Trend (6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" name="Created" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="won" stroke="hsl(var(--chart-2))" name="Won" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Stages by Value */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stage Value Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funnelData.sort((a, b) => b.value - a.value).slice(0, 8).map(stage => (
              <div key={stage.name} className="flex items-center gap-3">
                <span className="text-xs w-32 truncate text-muted-foreground">{stage.name}</span>
                <Progress value={funnelData[0]?.value ? (stage.value / funnelData.sort((a, b) => b.value - a.value)[0].value) * 100 : 0} className="flex-1 h-2" />
                <span className="text-xs font-medium w-24 text-right">${stage.value.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground w-12 text-right">{stage.count} leads</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
