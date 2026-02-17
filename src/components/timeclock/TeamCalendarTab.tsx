import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, CalendarDays } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";
import type { LeaveRequest } from "@/hooks/useLeaveManagement";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Props {
  requests: LeaveRequest[];
  profiles: Profile[];
  onReview: (id: string, status: "approved" | "denied", note?: string) => void;
  currentProfileId?: string;
  isAdmin?: boolean;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const typeLabels: Record<string, string> = {
  vacation: "Vacation", sick: "Sick", personal: "Personal", bereavement: "Bereavement", unpaid: "Unpaid",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-600 border-green-500/30",
  denied: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export function TeamCalendarTab({ requests, profiles, onReview, currentProfileId, isAdmin }: Props) {
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const today = new Date();

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedToday = requests.filter(
    (r) => r.status === "approved" &&
      isWithinInterval(today, { start: parseISO(r.start_date), end: parseISO(r.end_date) })
  );

  const getProfile = (profileId: string) => profiles.find((p) => p.id === profileId);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{approvedToday.length}</p>
            <p className="text-xs text-muted-foreground">Off Today</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Who's Off Today */}
      {approvedToday.length > 0 && (
        <>
          <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Off Today
          </h3>
          <div className="flex flex-wrap gap-2">
            {approvedToday.map((req) => {
              const profile = getProfile(req.profile_id);
              if (!profile) return null;
              return (
                <Badge key={req.id} variant="secondary" className="gap-1.5 py-1 px-2">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback className="text-[8px]">{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  {profile.full_name} · {typeLabels[req.leave_type]}
                </Badge>
              );
            })}
          </div>
        </>
      )}

      {/* Pending Requests */}
      <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground pt-2">Pending Requests</h3>
      <ScrollArea className="h-[350px]">
        <div className="space-y-2">
          {pendingRequests.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No pending requests.</p>
          )}
          {pendingRequests.map((req) => {
            const profile = getProfile(req.profile_id);
            return (
              <Card key={req.id} className="border-yellow-500/20 bg-yellow-500/5">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{getInitials(profile?.full_name || "?")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{profile?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabels[req.leave_type]} · {format(parseISO(req.start_date), "MMM d")} – {format(parseISO(req.end_date), "MMM d")}
                        {" · "}{req.total_days} day{req.total_days !== 1 ? "s" : ""}
                      </p>
                      {req.assigned_approver_id && (
                        <p className="text-xs text-muted-foreground">
                          Assigned Approver: <span className="font-medium">{getProfile(req.assigned_approver_id)?.full_name || "Unknown"}</span>
                        </p>
                      )}
                      {req.reason && <p className="text-xs text-muted-foreground truncate">{req.reason}</p>}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Optional note..."
                    rows={1}
                    value={reviewNotes[req.id] || ""}
                    onChange={(e) => setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    className="text-xs"
                  />
                  {(isAdmin || currentProfileId === req.assigned_approver_id) && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                        onClick={() => { onReview(req.id, "approved", reviewNotes[req.id]); setReviewNotes((p) => { const n = { ...p }; delete n[req.id]; return n; }); }}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1"
                        onClick={() => { onReview(req.id, "denied", reviewNotes[req.id]); setReviewNotes((p) => { const n = { ...p }; delete n[req.id]; return n; }); }}
                      >
                        <X className="w-3.5 h-3.5" /> Deny
                      </Button>
                    </div>
                  )}
                  {!isAdmin && currentProfileId !== req.assigned_approver_id && (
                    <p className="text-xs text-muted-foreground italic">Awaiting assigned approver</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Recent Decisions */}
      <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground pt-2">Recent Decisions</h3>
      <ScrollArea className="h-[200px]">
        <div className="space-y-2">
          {requests.filter((r) => r.status === "approved" || r.status === "denied").slice(0, 20).map((req) => {
            const profile = getProfile(req.profile_id);
            return (
              <Card key={req.id} className="border-border/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback className="text-[9px]">{getInitials(profile?.full_name || "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[req.leave_type]} · {format(parseISO(req.start_date), "MMM d")} – {format(parseISO(req.end_date), "MMM d")}
                    </p>
                    {req.approval_routing && (
                      <p className="text-[10px] text-muted-foreground italic">{req.approval_routing}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={statusColors[req.status]}>{req.status}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
