import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Lock } from "lucide-react";
import { PayrollWeeklySummary } from "@/hooks/usePayrollAudit";

interface Props {
  history: PayrollWeeklySummary[];
  isLoading: boolean;
}

export function PayrollHistoryTab({ history, isLoading }: Props) {
  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading history…</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Lock className="w-8 h-8 mb-3 opacity-50" />
        <p className="text-lg font-bold">No Locked Weeks</p>
        <p className="text-sm">Locked payroll snapshots will appear here.</p>
      </div>
    );
  }

  // Group by week
  const weeks = new Map<string, PayrollWeeklySummary[]>();
  for (const s of history) {
    const key = s.week_start;
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(s);
  }

  const exportCSV = (weekStart: string, entries: PayrollWeeklySummary[]) => {
    const headers = "Employee,Type,Paid Hours,Regular,Overtime,Status\n";
    const rows = entries.map(e => `${e.profile_id},${e.employee_type},${e.total_paid_hours},${e.regular_hours},${e.overtime_hours},${e.status}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${weekStart}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {Array.from(weeks.entries()).map(([weekStart, entries]) => {
        const totalHours = entries.reduce((s, e) => s + e.total_paid_hours, 0);
        const lockedAt = entries[0]?.locked_at;
        return (
          <Card key={weekStart}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{weekStart} — {entries[0]?.week_end}</p>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entries.length} employees · {totalHours.toFixed(1)} total hours
                  {lockedAt && ` · Locked ${new Date(lockedAt).toLocaleDateString()}`}
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCSV(weekStart, entries)}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
