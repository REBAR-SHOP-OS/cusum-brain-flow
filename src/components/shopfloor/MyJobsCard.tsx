import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Wrench, Clock, ArrowRight, Loader2 } from "lucide-react";

export function MyJobsCard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["my-work-orders", profile?.full_name],
    enabled: !!profile?.full_name,
    queryFn: async () => {
      /**
       * TODO: assigned_to is a text field matching full_name, not a profile ID.
       * This is fragile — duplicate names or name changes will break assignment.
       * Ideally migrate assigned_to to reference profile IDs.
       */
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, priority, scheduled_start, workstation")
        .eq("assigned_to", profile!.full_name)
        .in("status", ["pending", "in_progress", "queued"])
        .order("priority", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (workOrders.length === 0) return null;

  const statusColor: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    queued: "bg-warning/20 text-warning",
    in_progress: "bg-primary/20 text-primary",
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-wider">My Jobs</span>
          </div>
          <Link to="/timeclock">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <Clock className="w-3 h-3" />
              Clock In/Out
            </Button>
          </Link>
        </div>
        <div className="space-y-2">
          {workOrders.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center justify-between p-2 rounded-md bg-background/60 border border-border/50"
            >
              <div>
                <span className="text-xs font-medium">{wo.work_order_number}</span>
                {wo.workstation && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    @ {wo.workstation}
                  </span>
                )}
              </div>
              <Badge className={statusColor[wo.status] || statusColor.pending} variant="outline">
                {wo.status?.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
        <Link to="/shopfloor/station" className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

MyJobsCard.displayName = "MyJobsCard";
