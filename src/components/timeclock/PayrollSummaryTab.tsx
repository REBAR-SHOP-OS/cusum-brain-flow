import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, AlertTriangle, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  is_active?: boolean;
}

interface WeeklySummary {
  id: string;
  profile_id: string;
  employee_type: string;
  regular_hours: number;
  overtime_hours: number;
  total_paid_hours: number;
  total_exceptions: number;
  status: string;
  week_start: string;
  week_end: string;
}

interface PayrollSummaryTabProps {
  isAdmin: boolean;
  myProfile: Profile | null;
  profiles: Profile[];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-green-500/15 text-green-600",
  locked: "bg-primary/15 text-primary",
};

export function PayrollSummaryTab({ isAdmin, myProfile, profiles }: PayrollSummaryTabProps) {
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const wsStr = format(weekStart, "yyyy-MM-dd");
      const weStr = format(weekEnd, "yyyy-MM-dd");

      let query = supabase
        .from("payroll_weekly_summary")
        .select("*")
        .gte("week_start", wsStr)
        .lte("week_start", weStr);

      if (!isAdmin && myProfile) {
        query = query.eq("profile_id", myProfile.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setSummaries(data as WeeklySummary[]);
      }
      setLoading(false);
    }
    fetch();
  }, [isAdmin, myProfile?.id]);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  if (loading) {
    return <p className="text-muted-foreground text-sm text-center py-8">Loading payroll data...</p>;
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No payroll summary for this week yet.</p>
        <p className="text-xs text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          Current Week: {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {summaries.length} employee{summaries.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-480px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summaries.map((s) => {
            const profile = profileMap.get(s.profile_id);
            const name = profile?.full_name || "Unknown";

            return (
              <Card key={s.id} className="transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.employee_type}</p>
                    </div>
                    <Badge className={cn("text-[10px] uppercase tracking-wider", statusStyles[s.status] || statusStyles.draft)}>
                      {s.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold text-foreground">{s.regular_hours.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Regular</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className={cn("text-lg font-bold", s.overtime_hours > 0 ? "text-orange-500" : "text-foreground")}>
                        {s.overtime_hours.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overtime</p>
                    </div>
                    <div className="rounded-md bg-primary/10 p-2">
                      <p className="text-lg font-bold text-primary">{s.total_paid_hours.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                    </div>
                  </div>

                  {s.total_exceptions > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-500">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {s.total_exceptions} exception{s.total_exceptions !== 1 ? "s" : ""}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
