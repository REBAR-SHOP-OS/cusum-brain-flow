import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, TrendingUp, DollarSign, Star, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, Cell } from "recharts";

export function ClientPerformanceDashboard() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["client-performance-memory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_performance_memory")
        .select("*, customers(name, company_name)")
        .order("client_lifetime_score", { ascending: false })
        .limit(100);
      if (error) { console.warn("client_performance_memory:", error.message); return []; }
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading client performance...</div>;
  }

  const totalRevenue = clients.reduce((s, c) => s + ((c.total_revenue as number) || 0), 0);
  const avgWinRate = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + ((c.win_rate_pct as number) || 0), 0) / clients.length)
    : 0;
  const topClients = clients.slice(0, 10);
  const avgScore = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + ((c.client_lifetime_score as number) || 0), 0) / clients.length)
    : 0;

  // Revenue chart
  const revenueData = topClients.map(c => ({
    name: ((c as any).customers?.name || "Unknown").slice(0, 16),
    revenue: Math.round((c.total_revenue as number) || 0),
    winRate: Math.round((c.win_rate_pct as number) || 0),
    score: Math.round((c.client_lifetime_score as number) || 0),
  }));

  // Score distribution
  const scoreBuckets = [
    { range: "0–20", count: clients.filter(c => (c.client_lifetime_score || 0) <= 20).length },
    { range: "21–40", count: clients.filter(c => (c.client_lifetime_score || 0) > 20 && (c.client_lifetime_score || 0) <= 40).length },
    { range: "41–60", count: clients.filter(c => (c.client_lifetime_score || 0) > 40 && (c.client_lifetime_score || 0) <= 60).length },
    { range: "61–80", count: clients.filter(c => (c.client_lifetime_score || 0) > 60 && (c.client_lifetime_score || 0) <= 80).length },
    { range: "81–100", count: clients.filter(c => (c.client_lifetime_score || 0) > 80).length },
  ];

  const tierColors = ["hsl(var(--destructive))", "hsl(var(--chart-4))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--primary))"];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tracked Clients</span>
            </div>
            <p className="text-lg font-bold">{clients.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Revenue</span>
            </div>
            <p className="text-lg font-bold">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Win Rate</span>
            </div>
            <p className="text-lg font-bold">{avgWinRate}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Lifetime Score</span>
            </div>
            <p className="text-lg font-bold">{avgScore}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Clients by Revenue */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No client data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lifetime Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scoreBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Clients">
                  {scoreBuckets.map((_, i) => (
                    <Cell key={i} fill={tierColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Client Performance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-2">Client</th>
                    <th className="text-right px-2">Score</th>
                    <th className="text-right px-2">Revenue</th>
                    <th className="text-right px-2">Win Rate</th>
                    <th className="text-right px-2">Won</th>
                    <th className="text-right px-2">Lost</th>
                    <th className="text-right px-2">Reorder %</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 25).map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 pr-2 truncate max-w-[180px] font-medium">{c.customers?.name || "Unknown"}</td>
                      <td className="text-right px-2">
                        <Badge variant="outline" className={cn("text-[9px]",
                          (c.client_lifetime_score || 0) > 70 ? "border-emerald-500/30 text-emerald-600" :
                          (c.client_lifetime_score || 0) > 40 ? "border-amber-500/30 text-amber-600" :
                          "border-destructive/30 text-destructive"
                        )}>
                          {Math.round(c.client_lifetime_score || 0)}
                        </Badge>
                      </td>
                      <td className="text-right px-2">${((c.total_revenue || 0) as number).toLocaleString()}</td>
                      <td className="text-right px-2">{Math.round(c.win_rate_pct || 0)}%</td>
                      <td className="text-right px-2">{c.total_won_leads}</td>
                      <td className="text-right px-2">{c.total_lost_leads}</td>
                      <td className="text-right px-2">{Math.round(c.reorder_rate_pct || 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No client performance data. Run the client performance recalculation to populate this dashboard.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
