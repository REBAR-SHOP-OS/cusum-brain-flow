import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { PayrollDailySnapshot } from "@/hooks/usePayrollAudit";

interface Props {
  snapshots: PayrollDailySnapshot[];
  profiles: { id: string; full_name: string }[];
  isLocked: boolean;
}

const typeLabels: Record<string, string> = {
  missing_punch: "Missed Punch",
  hours_mismatch: "Hours Mismatch",
  early_late: "Early / Late",
  lunch_overlap: "Lunch Overlap",
  overtime_threshold: "OT Threshold",
};

export function PayrollExceptionsTab({ snapshots, profiles, isLocked }: Props) {
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const exceptionsFlat = snapshots
    .filter((s) => s.exceptions.length > 0)
    .flatMap((s) =>
      s.exceptions.map((ex: any, i: number) => ({
        ...ex,
        date: s.work_date,
        profileId: s.profile_id,
        employeeName: profileMap[s.profile_id]?.full_name || "Unknown",
        snapshotId: s.id,
        key: `${s.id}-${i}`,
        aiNotes: s.ai_notes,
      }))
    );

  if (exceptionsFlat.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-bold">No Exceptions</p>
        <p className="text-sm">All employees have clean records this week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
        {exceptionsFlat.length} exception{exceptionsFlat.length !== 1 ? "s" : ""} require attention
      </p>

      {exceptionsFlat.map((ex) => (
        <Card key={ex.key}>
          <CardContent className="p-4 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">{ex.employeeName}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-widest">
                  {typeLabels[ex.type] || ex.type}
                </Badge>
                <span className="text-xs text-muted-foreground">{ex.date}</span>
              </div>
              <p className="text-sm text-muted-foreground">{ex.message}</p>
              {ex.aiNotes && (
                <p className="text-xs text-muted-foreground italic">🤖 {ex.aiNotes}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-[9px]">
                  {ex.confidence}% confidence
                </Badge>
              </div>
            </div>
            {!isLocked && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-xs">Approve</Button>
                <Button size="sm" variant="outline" className="text-xs text-destructive">Reject</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
