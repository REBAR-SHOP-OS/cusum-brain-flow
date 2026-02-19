import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Trophy, Target } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface RepPerformanceDashboardProps {
  leads: LeadWithCustomer[];
  isLoading?: boolean;
}

interface RepStats {
  name: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  activeLeads: number;
  totalRevenue: number;
  winRate: number;
  avgDealSize: number;
  territories: Set<string>;
}

export function RepPerformanceDashboard({ leads, isLoading }: RepPerformanceDashboardProps) {
  const repStats = useMemo(() => {
    const reps = new Map<string, RepStats>();

    leads.forEach((lead) => {
      const meta = lead.metadata as Record<string, unknown> | null;
      const repName = (meta?.odoo_salesperson as string) || lead.assigned_to || "Unassigned";
      
      if (!reps.has(repName)) {
        reps.set(repName, {
          name: repName,
          totalLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          activeLeads: 0,
          totalRevenue: 0,
          winRate: 0,
          avgDealSize: 0,
          territories: new Set(),
        });
      }

      const stats = reps.get(repName)!;
      stats.totalLeads++;

      if (lead.stage === "won") {
        stats.wonLeads++;
        stats.totalRevenue += lead.expected_value || 0;
      } else if (lead.stage === "lost" || lead.stage === "loss") {
        stats.lostLeads++;
      } else {
        stats.activeLeads++;
      }

      if ((lead as any).territory) {
        stats.territories.add((lead as any).territory);
      }
    });

    // Calculate derived metrics
    reps.forEach((stats) => {
      const closedDeals = stats.wonLeads + stats.lostLeads;
      stats.winRate = closedDeals > 0 ? (stats.wonLeads / closedDeals) * 100 : 0;
      stats.avgDealSize = stats.wonLeads > 0 ? stats.totalRevenue / stats.wonLeads : 0;
    });

    return Array.from(reps.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [leads]);

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground p-4">Loading rep data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active Reps</span>
            </div>
            <p className="text-2xl font-bold mt-1">{repStats.filter(r => r.name !== "Unassigned").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Won</span>
            </div>
            <p className="text-2xl font-bold mt-1">{repStats.reduce((s, r) => s + r.wonLeads, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Avg Win Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {repStats.length > 0
                ? Math.round(repStats.reduce((s, r) => s + r.winRate, 0) / repStats.filter(r => r.wonLeads + r.lostLeads > 0).length || 1)
                : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Unassigned</span>
            </div>
            <p className="text-2xl font-bold mt-1">{repStats.find(r => r.name === "Unassigned")?.totalLeads || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rep Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-4 font-medium">Rep</th>
                  <th className="text-right py-2 px-4 font-medium">Active</th>
                  <th className="text-right py-2 px-4 font-medium">Won</th>
                  <th className="text-right py-2 px-4 font-medium">Lost</th>
                  <th className="text-right py-2 px-4 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-4 font-medium">Revenue</th>
                  <th className="text-right py-2 px-4 font-medium">Avg Deal</th>
                  <th className="text-left py-2 px-4 font-medium">Territories</th>
                </tr>
              </thead>
              <tbody>
                {repStats.map((rep) => (
                  <tr key={rep.name} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-4 font-medium">{rep.name}</td>
                    <td className="py-2 px-4 text-right">{rep.activeLeads}</td>
                    <td className="py-2 px-4 text-right text-emerald-600">{rep.wonLeads}</td>
                    <td className="py-2 px-4 text-right text-destructive">{rep.lostLeads}</td>
                    <td className="py-2 px-4 text-right">
                      <Badge variant={rep.winRate >= 50 ? "default" : "secondary"} className="text-[10px]">
                        {Math.round(rep.winRate)}%
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-right font-medium">
                      ${rep.totalRevenue.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      ${Math.round(rep.avgDealSize).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      {rep.territories.size > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {Array.from(rep.territories).slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
