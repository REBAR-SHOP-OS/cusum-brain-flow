import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Trophy, XCircle, Clock, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TransitionEvent {
  id: string;
  lead_id: string;
  from_stage: string;
  to_stage: string;
  triggered_by: string;
  transition_result: string;
  block_reason_code: string;
  block_reason_detail: unknown;
  company_id: string;
  created_at: string;
  user_id: string;
}

const STAGE_ICONS: Record<string, typeof ArrowRight> = {
  won: Trophy,
  lost: XCircle,
};

function getEventIcon(toStage: string) {
  return STAGE_ICONS[toStage] || ArrowRight;
}

function getEventColor(toStage: string): string {
  if (toStage === "won") return "text-emerald-500";
  if (toStage === "lost" || toStage === "loss") return "text-destructive";
  return "text-primary";
}

export function PipelineActivityFeed() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["pipeline-activity-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_transition_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as TransitionEvent[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Recent Pipeline Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading activity...</div>
          ) : events.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No recent activity</div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => {
                const Icon = getEventIcon(event.to_stage);
                const color = getEventColor(event.to_stage);
                const timeAgo = formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true });

                return (
                  <div key={event.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-tight">
                        <span className="font-medium">Lead</span>
                        {event.from_stage ? (
                          <span className="text-muted-foreground">
                            {" "}moved from <span className="font-medium">{event.from_stage.replace(/_/g, " ")}</span> to{" "}
                          </span>
                        ) : (
                          <span className="text-muted-foreground"> moved to </span>
                        )}
                        <span className="font-medium">{event.to_stage.replace(/_/g, " ")}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                        {event.triggered_by && (
                          <span className="text-[10px] text-muted-foreground">by {event.triggered_by}</span>
                        )}
                        {event.transition_result !== "allowed" && (
                          <span className="text-[10px] text-destructive italic">— {event.block_reason_code || event.transition_result}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
