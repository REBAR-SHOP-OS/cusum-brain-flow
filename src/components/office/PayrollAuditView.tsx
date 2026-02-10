import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Download, Lock, Calendar } from "lucide-react";
import { usePayrollAudit } from "@/hooks/usePayrollAudit";
import { useProfiles } from "@/hooks/useProfiles";
import { PayrollOverviewTab } from "./payroll/PayrollOverviewTab";
import { PayrollExceptionsTab } from "./payroll/PayrollExceptionsTab";
import { PayrollComplianceTab } from "./payroll/PayrollComplianceTab";
import { PayrollHistoryTab } from "./payroll/PayrollHistoryTab";

export function PayrollAuditView() {
  const {
    weekStart, weekEnd, prevWeek, nextWeek, currentWeek,
    snapshots, weeklySummaries, history,
    isLoading, historyLoading,
    computePayroll, approveEmployee, approveAllClean, lockWeek, isLocked,
  } = usePayrollAudit();
  const { profiles } = useProfiles();

  const profileList = profiles.map(p => ({ id: p.id, full_name: p.full_name, department: p.department }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">Payroll Audit</h1>
          <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">
            Ontario-Compliant Payroll Verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Week Picker */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button onClick={currentWeek} className="text-xs font-bold px-2 hover:text-primary transition-colors">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              {weekStart} — {weekEnd}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {isLocked && (
            <span className="text-[10px] tracking-widest text-primary uppercase font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> LOCKED
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8">
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview" className="text-xs uppercase tracking-widest">Overview</TabsTrigger>
              <TabsTrigger value="exceptions" className="text-xs uppercase tracking-widest">Exceptions</TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs uppercase tracking-widest">Compliance</TabsTrigger>
              <TabsTrigger value="history" className="text-xs uppercase tracking-widest">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <PayrollOverviewTab
                summaries={weeklySummaries}
                snapshots={snapshots}
                profiles={profileList}
                isLocked={isLocked}
                onApproveEmployee={(id) => approveEmployee.mutate(id)}
                onApproveAllClean={() => approveAllClean.mutate()}
                onComputePayroll={() => computePayroll.mutate()}
                onLockWeek={() => lockWeek.mutate()}
                isComputing={computePayroll.isPending}
              />
            </TabsContent>

            <TabsContent value="exceptions">
              <PayrollExceptionsTab
                snapshots={snapshots}
                profiles={profileList}
                isLocked={isLocked}
              />
            </TabsContent>

            <TabsContent value="compliance">
              <PayrollComplianceTab snapshots={snapshots} summaries={weeklySummaries} />
            </TabsContent>

            <TabsContent value="history">
              <PayrollHistoryTab history={history} isLoading={historyLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
