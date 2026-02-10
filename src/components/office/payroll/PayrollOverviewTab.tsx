import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, AlertTriangle, CheckCircle2, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { PayrollWeeklySummary, PayrollDailySnapshot } from "@/hooks/usePayrollAudit";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  summaries: PayrollWeeklySummary[];
  snapshots: PayrollDailySnapshot[];
  profiles: { id: string; full_name: string; department?: string | null }[];
  isLocked: boolean;
  onApproveEmployee: (profileId: string) => void;
  onApproveAllClean: () => void;
  onComputePayroll: () => void;
  onLockWeek: () => void;
  isComputing: boolean;
}

export function PayrollOverviewTab({
  summaries, snapshots, profiles, isLocked,
  onApproveEmployee, onApproveAllClean, onComputePayroll, onLockWeek, isComputing,
}: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const totalEmployees = summaries.length;
  const totalPaidHours = summaries.reduce((s, e) => s + e.total_paid_hours, 0);
  const totalOT = summaries.reduce((s, e) => s + e.overtime_hours, 0);
  const totalExceptions = summaries.reduce((s, e) => s + e.total_exceptions, 0);
  const hasFailures = totalExceptions > 0 && summaries.some(s => s.total_exceptions > 0 && s.status !== "approved");

  const getStatus = (s: PayrollWeeklySummary) => {
    if (s.status === "locked") return { label: "LOCKED", variant: "secondary" as const, icon: Shield };
    if (s.status === "approved") return { label: "APPROVED", variant: "secondary" as const, icon: CheckCircle2 };
    if (s.total_exceptions === 0) return { label: "CLEAN", variant: "secondary" as const, icon: CheckCircle2 };
    return { label: "NEEDS REVIEW", variant: "destructive" as const, icon: AlertTriangle };
  };

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Employees", value: totalEmployees, icon: Users },
          { label: "Total Paid Hours", value: totalPaidHours.toFixed(1) },
          { label: "Overtime Hours", value: totalOT.toFixed(1), icon: Clock, highlight: totalOT > 0 },
          { label: "Exceptions", value: totalExceptions, icon: AlertTriangle, highlight: totalExceptions > 0 },
          { label: "Compliance", value: hasFailures ? "REVIEW" : "PASS", icon: Shield, highlight: hasFailures },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1">{card.label}</p>
              <p className={`text-2xl font-black italic ${card.highlight ? "text-primary" : "text-foreground"}`}>
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={onComputePayroll} disabled={isComputing || isLocked} size="sm" className="gap-1.5">
          {isComputing ? "Computing…" : "Compute Payroll"}
        </Button>
        <Button variant="outline" size="sm" onClick={onApproveAllClean} disabled={isLocked}>
          Approve All Clean
        </Button>
        <Button variant="outline" size="sm" onClick={onLockWeek} disabled={isLocked || hasFailures}>
          🔒 Lock Week
        </Button>
      </div>

      {/* Employee Table */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[24px_1fr_90px_70px_70px_70px_70px_60px_90px] gap-0 px-4 py-3 bg-muted/50 border-b border-border text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            <span />
            <span>Employee</span>
            <span>Role</span>
            <span>Expected</span>
            <span>Actual</span>
            <span>Regular</span>
            <span>OT</span>
            <span>Exc.</span>
            <span>Status</span>
          </div>

          {summaries.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No payroll data. Click "Compute Payroll" to process this week.
            </div>
          )}

          {summaries.map((s) => {
            const profile = profileMap[s.profile_id];
            const st = getStatus(s);
            const isExpanded = expandedRow === s.profile_id;
            const dailies = snapshots.filter(sn => sn.profile_id === s.profile_id).sort((a, b) => a.work_date.localeCompare(b.work_date));
            const expectedHrs = (dailies.reduce((sum, d) => sum + d.expected_minutes, 0) / 60).toFixed(1);

            return (
              <Collapsible key={s.profile_id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : s.profile_id)}>
                <CollapsibleTrigger asChild>
                  <div className="grid grid-cols-[24px_1fr_90px_70px_70px_70px_70px_60px_90px] gap-0 px-4 py-3 border-b border-border/30 hover:bg-muted/20 items-center cursor-pointer">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="text-sm font-bold text-foreground">{profile?.full_name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground uppercase">{s.employee_type}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{expectedHrs}</span>
                    <span className="text-sm tabular-nums font-bold text-foreground">{s.total_paid_hours.toFixed(1)}</span>
                    <span className="text-sm tabular-nums text-foreground">{s.regular_hours.toFixed(1)}</span>
                    <span className={`text-sm tabular-nums ${s.overtime_hours > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {s.overtime_hours > 0 ? s.overtime_hours.toFixed(1) : "—"}
                    </span>
                    <span className={`text-sm tabular-nums ${s.total_exceptions > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                      {s.total_exceptions || "—"}
                    </span>
                    <Badge variant={st.variant} className="text-[9px] uppercase tracking-widest w-fit gap-1">
                      <st.icon className="w-3 h-3" /> {st.label}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-muted/10 border-b border-border/30">
                    {dailies.map((d) => (
                      <div key={d.work_date} className="grid grid-cols-[24px_1fr_90px_70px_70px_70px_70px_60px_90px] gap-0 px-4 py-2 items-center text-xs">
                        <span />
                        <span className="text-muted-foreground">{d.work_date}</span>
                        <span />
                        <span className="tabular-nums text-muted-foreground">{(d.expected_minutes / 60).toFixed(1)}</span>
                        <span className="tabular-nums">{(d.paid_minutes / 60).toFixed(1)}</span>
                        <span className="tabular-nums">{((d.paid_minutes - d.overtime_minutes) / 60).toFixed(1)}</span>
                        <span className={`tabular-nums ${d.overtime_minutes > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {d.overtime_minutes > 0 ? (d.overtime_minutes / 60).toFixed(1) : "—"}
                        </span>
                        <span className={d.exceptions.length > 0 ? "text-destructive" : "text-muted-foreground"}>
                          {d.exceptions.length || "—"}
                        </span>
                        <span />
                      </div>
                    ))}
                    {/* AI Notes */}
                    {dailies[0]?.ai_notes && (
                      <div className="px-8 py-2 text-xs text-muted-foreground italic border-t border-border/20">
                        🤖 {dailies[0].ai_notes}
                      </div>
                    )}
                    {/* Approve button for this employee */}
                    {s.status === "draft" && !isLocked && (
                      <div className="px-8 py-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => onApproveEmployee(s.profile_id)}>
                          ✅ Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
