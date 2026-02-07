import { DollarSign } from "lucide-react";

export function PayrollAuditView() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <DollarSign className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-black italic text-foreground uppercase">Payroll Audit</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Time tracking summaries, overtime calculations, and payroll export for workshop and field staff.
      </p>
      <p className="text-xs text-muted-foreground/60 tracking-widest uppercase">Coming Soon</p>
    </div>
  );
}
