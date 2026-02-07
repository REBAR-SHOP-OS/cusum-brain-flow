import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, Calendar, Clock, Users, Download, 
  ChevronDown, AlertTriangle, CheckCircle2 
} from "lucide-react";

// Mock payroll data
const payrollSummary = [
  { name: "Ali K.", role: "Cutter Operator", hours: 42.5, overtime: 2.5, rate: 28, status: "approved" },
  { name: "James R.", role: "Bender Operator", hours: 40, overtime: 0, rate: 26, status: "approved" },
  { name: "Mike S.", role: "Driver", hours: 38, overtime: 0, rate: 24, status: "pending" },
  { name: "David L.", role: "Shop Floor Lead", hours: 45, overtime: 5, rate: 32, status: "flagged" },
  { name: "Sarah T.", role: "Office Admin", hours: 40, overtime: 0, rate: 22, status: "approved" },
];

export function PayrollAuditView() {
  const [period, setPeriod] = useState("current");

  const totalHours = payrollSummary.reduce((s, p) => s + p.hours, 0);
  const totalOT = payrollSummary.reduce((s, p) => s + p.overtime, 0);
  const totalPay = payrollSummary.reduce((s, p) => s + (p.hours * p.rate) + (p.overtime * p.rate * 1.5), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">Payroll Audit</h1>
          <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">Time Tracking & Compensation Review</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" /> This Week <ChevronDown className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Total Staff</p>
                <p className="text-3xl font-black italic text-foreground">{payrollSummary.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Total Hours</p>
                <p className="text-3xl font-black italic text-foreground">{totalHours.toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Overtime Hours</p>
                <p className="text-3xl font-black italic text-primary">{totalOT.toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Gross Payroll</p>
                <p className="text-3xl font-black italic text-foreground">${totalPay.toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Payroll Table */}
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_120px_80px_80px_80px_100px_100px] gap-0 px-5 py-3 bg-muted/50 border-b border-border text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                <span>Employee</span>
                <span>Role</span>
                <span>Hours</span>
                <span>OT</span>
                <span>Rate</span>
                <span>Gross Pay</span>
                <span>Status</span>
              </div>

              {payrollSummary.map((emp) => {
                const gross = (emp.hours * emp.rate) + (emp.overtime * emp.rate * 1.5);
                return (
                  <div
                    key={emp.name}
                    className="grid grid-cols-[1fr_120px_80px_80px_80px_100px_100px] gap-0 px-5 py-3 border-b border-border/30 hover:bg-muted/20 items-center"
                  >
                    <span className="text-sm font-bold text-foreground">{emp.name}</span>
                    <span className="text-xs text-muted-foreground">{emp.role}</span>
                    <span className="text-sm text-foreground tabular-nums">{emp.hours}</span>
                    <span className={`text-sm tabular-nums ${emp.overtime > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {emp.overtime > 0 ? emp.overtime : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">${emp.rate}/hr</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">${gross.toFixed(0)}</span>
                    <Badge
                      variant={emp.status === "approved" ? "secondary" : emp.status === "flagged" ? "destructive" : "outline"}
                      className="text-[9px] uppercase tracking-widest w-fit"
                    >
                      {emp.status === "flagged" && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {emp.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {emp.status}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
