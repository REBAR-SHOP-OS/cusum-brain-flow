import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { X } from "lucide-react";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import type { LeaveBalance, LeaveRequest } from "@/hooks/useLeaveManagement";

interface Profile {
  id: string;
  full_name: string;
}

interface Props {
  balance: LeaveBalance | null;
  requests: LeaveRequest[];
  profiles: Profile[];
  onSubmit: (data: { leave_type: string; start_date: string; end_date: string; total_days: number; reason?: string }) => Promise<boolean>;
  onCancel: (id: string) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-600 border-green-500/30",
  denied: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  bereavement: "Bereavement",
  unpaid: "Unpaid",
};

export function MyLeaveTab({ balance, requests, profiles, onSubmit, onCancel }: Props) {
  const getApproverName = (id: string | null) => {
    if (!id) return null;
    return profiles.find((p) => p.id === id)?.full_name || "Unknown";
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">My Leave Balances</h3>
        <LeaveRequestDialog onSubmit={onSubmit} />
      </div>

      <LeaveBalanceCards balance={balance} />

      <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground pt-2">My Requests</h3>
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {requests.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No leave requests yet.</p>
          )}
          {requests.map((req) => (
            <Card key={req.id} className="border-border/50">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{typeLabels[req.leave_type] || req.leave_type}</span>
                    <Badge variant="outline" className={statusColors[req.status]}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(req.start_date), "MMM d")} – {format(new Date(req.end_date), "MMM d, yyyy")}
                    {" · "}{req.total_days} day{req.total_days !== 1 ? "s" : ""}
                  </p>
                  {req.assigned_approver_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Approver: <span className="font-medium">{getApproverName(req.assigned_approver_id)}</span>
                    </p>
                  )}
                  {req.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{req.reason}</p>}
                  {req.review_note && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">Note: {req.review_note}</p>
                  )}
                </div>
                {req.status === "pending" && (
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => onCancel(req.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
