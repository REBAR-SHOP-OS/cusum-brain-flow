import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video, Clock, Users, CheckCircle2, ListTodo,
  ThumbsUp, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function MeetingIntelligence() {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Fetch this week's meetings
  const { data: meetings } = useQuery({
    queryKey: ["ceo-meetings-week"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_meetings")
        .select("*")
        .gte("started_at", weekStart.toISOString())
        .lte("started_at", weekEnd.toISOString())
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all draft action items
  const { data: draftActions } = useQuery({
    queryKey: ["ceo-draft-actions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meeting_action_items")
        .select("*, team_meetings!inner(title)")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Approve action
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("meeting_action_items")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceo-draft-actions"] });
      toast.success("Action item approved");
    },
  });

  const totalMeetings = meetings?.length || 0;
  const totalHours = (meetings || []).reduce((sum: number, m: any) => sum + (m.duration_seconds || 0) / 3600, 0);
  const endedMeetings = (meetings || []).filter((m: any) => m.status === "ended");
  const allDecisions = endedMeetings
    .filter((m: any) => m.structured_report?.decisions?.length)
    .flatMap((m: any) => m.structured_report.decisions.map((d: any) => ({
      ...d,
      meetingTitle: m.title,
      date: m.started_at,
    })));

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Meeting Intelligence
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
              <Video className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold tabular-nums">{totalMeetings}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">This Week</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
              <Clock className="w-4 h-4 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold tabular-nums">{totalHours.toFixed(1)}h</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Hours</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
              <ListTodo className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold tabular-nums">{draftActions?.length || 0}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Pending Actions</p>
            </div>
          </div>

          {expanded && (
            <>
              {/* Draft Action Items */}
              {(draftActions?.length || 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Unreviewed Action Items</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={async () => {
                        for (const a of (draftActions || [])) {
                          await approveMutation.mutateAsync(a.id);
                        }
                        toast.success("All action items approved");
                      }}
                    >
                      <ThumbsUp className="w-2.5 h-2.5" /> Approve All
                    </Button>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1.5">
                      {(draftActions || []).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.assignee_name || "Unassigned"} • {item.team_meetings?.title}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-green-400"
                            onClick={() => approveMutation.mutate(item.id)}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Recent Decisions */}
              {allDecisions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent Decisions</p>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1.5">
                      {allDecisions.slice(0, 8).map((d: any, i: number) => (
                        <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                          <p className="text-xs font-medium text-foreground">{d.decision || d}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {d.meetingTitle} • {format(new Date(d.date), "MMM d")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
