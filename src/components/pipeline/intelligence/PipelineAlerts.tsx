import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  title: string;
  description: string;
  leadId?: string;
  leadTitle?: string;
}

const TERMINAL_STAGES = new Set(["won", "lost", "loss", "merged", "archived_orphan", "no_rebars_out_of_scope", "dreamers", "migration_others", "delivered_pickup_done"]);

export function PipelineAlerts({ leads }: Props) {
  const alerts = useMemo(() => {
    const result: Alert[] = [];
    const now = new Date();

    // 1. Stale leads (active, no update in 14+ days)
    const staleLeads = leads.filter(l => {
      if (TERMINAL_STAGES.has(l.stage)) return false;
      return differenceInCalendarDays(now, new Date(l.updated_at)) >= 14;
    });
    if (staleLeads.length > 10) {
      result.push({
        id: "stale-bulk",
        severity: "critical",
        type: "stale_leads",
        title: `${staleLeads.length} stale leads detected`,
        description: `${staleLeads.length} active leads haven't been updated in 14+ days. Top: ${staleLeads.slice(0, 3).map(l => l.title).join(", ")}`,
      });
    } else {
      staleLeads.forEach(l => {
        const days = differenceInCalendarDays(now, new Date(l.updated_at));
        result.push({
          id: `stale-${l.id}`,
          severity: days > 30 ? "critical" : "warning",
          type: "stale_lead",
          title: `Stale: ${l.title}`,
          description: `No update for ${days} days. Stage: ${PIPELINE_STAGES.find(s => s.id === l.stage)?.label || l.stage}`,
          leadId: l.id,
          leadTitle: l.title,
        });
      });
    }

    // 2. SLA breaches
    const slaBreached = leads.filter(l => l.sla_breached === true && !TERMINAL_STAGES.has(l.stage));
    if (slaBreached.length > 0) {
      result.push({
        id: "sla-breach",
        severity: "critical",
        type: "sla_breach",
        title: `${slaBreached.length} SLA breach${slaBreached.length > 1 ? "es" : ""}`,
        description: `Leads exceeding stage SLA: ${slaBreached.slice(0, 3).map(l => l.title).join(", ")}`,
      });
    }

    // 3. High-value leads with low win probability
    const atRisk = leads.filter(l => {
      if (TERMINAL_STAGES.has(l.stage)) return false;
      const value = (l.expected_value as number) || 0;
      const winProb = (l.win_prob_score as number) || 0;
      return value > 10000 && winProb > 0 && winProb < 30;
    });
    atRisk.forEach(l => {
      result.push({
        id: `atrisk-${l.id}`,
        severity: "warning",
        type: "at_risk",
        title: `At-risk: ${l.title}`,
        description: `$${((l.expected_value as number) || 0).toLocaleString()} deal with only ${Math.round((l.win_prob_score as number) || 0)}% win probability`,
        leadId: l.id,
        leadTitle: l.title,
      });
    });

    // 4. Overdue expected close dates
    const overdue = leads.filter(l => {
      if (TERMINAL_STAGES.has(l.stage)) return false;
      if (!l.expected_close_date) return false;
      return new Date(l.expected_close_date) < now;
    });
    if (overdue.length > 0) {
      result.push({
        id: "overdue-close",
        severity: "warning",
        type: "overdue_close",
        title: `${overdue.length} leads past expected close`,
        description: `Leads with overdue close dates: ${overdue.slice(0, 3).map(l => l.title).join(", ")}`,
      });
    }

    // 5. Data quality: leads with no expected value
    const noValue = leads.filter(l => {
      if (TERMINAL_STAGES.has(l.stage)) return false;
      const stage = l.stage;
      const advancedStages = ["qualified", "quotation_priority", "quotation_bids", "shop_drawing", "fabrication_in_shop"];
      return advancedStages.includes(stage) && ((l.expected_value as number) || 0) === 0;
    });
    if (noValue.length > 0) {
      result.push({
        id: "no-value",
        severity: "info",
        type: "data_quality",
        title: `${noValue.length} advanced leads missing revenue`,
        description: "Leads in advanced stages with $0 expected value — impacts forecast accuracy",
      });
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [leads]);

  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount = alerts.filter(a => a.severity === "warning").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {criticalCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" /> {criticalCount} Critical
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> {warningCount} Warning
          </Badge>
        )}
        {alerts.length === 0 && (
          <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" /> All clear
          </Badge>
        )}
      </div>

      {/* Alert Cards */}
      <div className="space-y-2">
        {alerts.map(alert => (
          <Card key={alert.id} className={cn(
            "border-l-4",
            alert.severity === "critical" ? "border-l-destructive" :
            alert.severity === "warning" ? "border-l-amber-500" : "border-l-blue-500"
          )}>
            <CardContent className="p-3 flex items-start gap-3">
              {alert.severity === "critical" ? <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> :
               alert.severity === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> :
               <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight">{alert.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{alert.type.replace(/_/g, " ")}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No pipeline alerts. Everything looks healthy! 🎉</p>
        </div>
      )}
    </div>
  );
}
