import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Database, Shield } from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  syncLogs: any[];
  leads: Lead[];
}

const SEVERITY_COLORS = {
  error: "hsl(var(--destructive))",
  warning: "hsl(var(--chart-4))",
  info: "hsl(var(--chart-2))",
};

export function SyncHealthDashboard({ syncLogs, leads }: Props) {
  const syncStats = useMemo(() => {
    const odooLeads = leads.filter(l => {
      const meta = l.metadata as Record<string, unknown> | null;
      return !!meta?.odoo_id;
    });
    const totalOdoo = odooLeads.length;
    const withWarnings = odooLeads.filter(l => {
      const meta = l.metadata as Record<string, unknown> | null;
      return ((meta?.validation_warnings as number) || 0) > 0;
    }).length;
    const cleanRate = totalOdoo > 0 ? Math.round(((totalOdoo - withWarnings) / totalOdoo) * 100) : 100;

    // Last sync time (most recently updated Odoo lead)
    const lastSync = odooLeads.length > 0
      ? new Date(Math.max(...odooLeads.map(l => new Date(l.updated_at).getTime())))
      : null;

    return { totalOdoo, withWarnings, cleanRate, lastSync };
  }, [leads]);

  // Validation log breakdown
  const logBreakdown = useMemo(() => {
    const byType: Record<string, { count: number; severity: string }> = {};
    const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };

    syncLogs.forEach(log => {
      const type = log.validation_type || "unknown";
      const severity = log.severity || "info";
      if (!byType[type]) byType[type] = { count: 0, severity };
      byType[type].count++;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    });

    return {
      byType: Object.entries(byType).map(([type, data]) => ({ type: type.replace(/_/g, " "), ...data })).sort((a, b) => b.count - a.count),
      bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })).filter(d => d.count > 0),
    };
  }, [syncLogs]);

  // Recent 7 days trend
  const dailyTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, "yyyy-MM-dd");
      const dayLogs = syncLogs.filter(l => l.created_at?.startsWith(dayStr));
      return {
        day: format(date, "EEE"),
        errors: dayLogs.filter(l => l.severity === "error").length,
        warnings: dayLogs.filter(l => l.severity === "warning").length,
        info: dayLogs.filter(l => l.severity === "info").length,
      };
    });
    return days;
  }, [syncLogs]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Odoo Leads</span>
            </div>
            <p className="text-lg font-bold">{syncStats.totalOdoo.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Clean Rate</span>
            </div>
            <p className={cn("text-lg font-bold", syncStats.cleanRate >= 90 ? "text-emerald-500" : syncStats.cleanRate >= 70 ? "text-amber-500" : "text-destructive")}>
              {syncStats.cleanRate}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">With Warnings</span>
            </div>
            <p className="text-lg font-bold">{syncStats.withWarnings}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Sync</span>
            </div>
            <p className="text-sm font-bold">
              {syncStats.lastSync ? formatDistanceToNow(syncStats.lastSync, { addSuffix: true }) : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Validation Issues by Type */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Validation Issues by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {logBreakdown.byType.length > 0 ? (
              <div className="space-y-2">
                {logBreakdown.byType.slice(0, 10).map(item => (
                  <div key={item.type} className="flex items-center gap-2">
                    {item.severity === "error" ? <XCircle className="w-3 h-3 text-destructive" /> :
                     item.severity === "warning" ? <AlertTriangle className="w-3 h-3 text-amber-500" /> :
                     <CheckCircle className="w-3 h-3 text-blue-500" />}
                    <span className="text-xs flex-1 truncate capitalize">{item.type}</span>
                    <Badge variant="outline" className="text-[10px]">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No validation logs recorded yet</p>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {logBreakdown.bySeverity.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={logBreakdown.bySeverity} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count"
                    label={({ severity, percent }) => `${severity} ${(percent * 100).toFixed(0)}%`}>
                    {logBreakdown.bySeverity.map((entry) => (
                      <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity as keyof typeof SEVERITY_COLORS] || "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-6">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Trend */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Validation Issues (7-Day Trend)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTrend}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="Errors" />
              <Bar dataKey="warnings" stackId="a" fill="hsl(var(--chart-4))" name="Warnings" />
              <Bar dataKey="info" stackId="a" fill="hsl(var(--chart-2))" name="Info" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
