import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Shield, Zap, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
}

export function SLAEnforcementDashboard({ leads }: Props) {
  const { data: escalationLogs = [] } = useQuery({
    queryKey: ["sla-escalation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_escalation_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { console.warn("sla_escalation_log:", error.message); return []; }
      return data || [];
    },
  });

  const slaStats = useMemo(() => {
    const activeLeads = leads.filter(l => !["won", "lost", "loss", "merged", "archived_orphan"].includes(l.stage));
    const withSla = activeLeads.filter(l => l.sla_deadline);
    const breached = activeLeads.filter(l => l.sla_breached === true);
    const atRisk = activeLeads.filter(l => {
      if (!l.sla_deadline || l.sla_breached) return false;
      const deadline = new Date(l.sla_deadline);
      const hoursLeft = (deadline.getTime() - Date.now()) / 3600000;
      return hoursLeft > 0 && hoursLeft < 4;
    });
    const complianceRate = withSla.length > 0
      ? Math.round(((withSla.length - breached.length) / withSla.length) * 100)
      : 100;

    return { total: withSla.length, breached: breached.length, atRisk: atRisk.length, complianceRate, breachedLeads: breached, atRiskLeads: atRisk };
  }, [leads]);

  // Escalation by stage
  const stageBreakdown = useMemo(() => {
    const byStage: Record<string, number> = {};
    escalationLogs.forEach(log => {
      const stage = (log as any).stage || "unknown";
      byStage[stage] = (byStage[stage] || 0) + 1;
    });
    return Object.entries(byStage)
      .map(([stage, count]) => ({ stage: stage.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [escalationLogs]);

  // Escalation by target
  const targetBreakdown = useMemo(() => {
    const byTarget: Record<string, number> = {};
    escalationLogs.forEach(log => {
      const target = (log as any).escalated_to || "Unknown";
      byTarget[target] = (byTarget[target] || 0) + 1;
    });
    return Object.entries(byTarget).map(([target, count]) => ({ target, count })).sort((a, b) => b.count - a.count);
  }, [escalationLogs]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SLA Compliance</span>
            </div>
            <p className={cn("text-lg font-bold", slaStats.complianceRate >= 90 ? "text-emerald-500" : slaStats.complianceRate >= 70 ? "text-amber-500" : "text-destructive")}>
              {slaStats.complianceRate}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Breaches</span>
            </div>
            <p className="text-lg font-bold text-destructive">{slaStats.breached}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">At Risk (&lt;4h)</span>
            </div>
            <p className="text-lg font-bold text-amber-500">{slaStats.atRisk}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Escalations</span>
            </div>
            <p className="text-lg font-bold">{escalationLogs.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Escalations by Stage */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Escalations by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageBreakdown} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Escalations" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No escalation data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Escalation Targets */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Escalated To</CardTitle>
          </CardHeader>
          <CardContent>
            {targetBreakdown.length > 0 ? (
              <div className="space-y-3">
                {targetBreakdown.map(item => (
                  <div key={item.target} className="flex items-center gap-3">
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs flex-1">{item.target}</span>
                    <Badge variant="outline" className="text-[10px]">{item.count}</Badge>
                    <Progress value={targetBreakdown[0]?.count ? (item.count / targetBreakdown[0].count) * 100 : 0} className="w-20 h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No escalations recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Breached Leads */}
      {slaStats.breachedLeads.length > 0 && (
        <Card className="border-border border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Active SLA Breaches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {slaStats.breachedLeads.slice(0, 15).map(lead => (
                <div key={lead.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="destructive" className="text-[9px] px-1.5">BREACHED</Badge>
                  <span className="flex-1 truncate font-medium">{lead.title}</span>
                  <span className="text-muted-foreground capitalize">{lead.stage?.replace(/_/g, " ")}</span>
                  {lead.escalated_to && <Badge variant="outline" className="text-[9px]">→ {lead.escalated_to}</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-Risk Leads */}
      {slaStats.atRiskLeads.length > 0 && (
        <Card className="border-border border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> At Risk (expiring within 4 hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {slaStats.atRiskLeads.slice(0, 10).map(lead => (
                <div key={lead.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] px-1.5 border-amber-500/30 text-amber-600">AT RISK</Badge>
                  <span className="flex-1 truncate font-medium">{lead.title}</span>
                  <span className="text-muted-foreground">
                    {lead.sla_deadline ? formatDistanceToNow(new Date(lead.sla_deadline), { addSuffix: true }) : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Escalation Log */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Escalation Log</CardTitle>
        </CardHeader>
        <CardContent>
          {escalationLogs.length > 0 ? (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {escalationLogs.slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground w-24 shrink-0">
                    {format(new Date(log.created_at), "MMM d, HH:mm")}
                  </span>
                  <Badge variant="outline" className="text-[9px]">{log.entity_type}</Badge>
                  <span className="capitalize flex-1 truncate">{log.stage?.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{log.sla_hours}h SLA</span>
                  <Badge variant="secondary" className="text-[9px]">→ {log.escalated_to}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No escalation logs yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
