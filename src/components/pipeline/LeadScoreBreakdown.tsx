import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  winProb: number;
  scoreConfidence: string | null;
  children: React.ReactNode;
}

export function LeadScoreBreakdown({ leadId, winProb, scoreConfidence, children }: Props) {
  const { data: history } = useQuery({
    queryKey: ["lead_score_history", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_score_history")
        .select("score, win_probability, score_factors, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const latest = history?.[0];
  const previous = history?.[1];
  const trend = latest && previous
    ? (latest.win_probability ?? 0) - (previous.win_probability ?? 0)
    : 0;

  const factors = (latest?.score_factors as Record<string, number> | null) ?? {};

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-3" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1">
              <Brain className="w-3 h-3 text-primary" /> Score Breakdown
            </span>
            <span className={cn(
              "text-[10px] font-medium capitalize px-1.5 py-0.5 rounded",
              scoreConfidence === "high" ? "bg-emerald-500/15 text-emerald-600"
                : scoreConfidence === "medium" ? "bg-amber-500/15 text-amber-600"
                : "bg-muted text-muted-foreground"
            )}>
              {scoreConfidence || "low"}
            </span>
          </div>

          {/* Win probability with trend */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">{Math.round(winProb)}%</span>
            {trend !== 0 && (
              <span className={cn("flex items-center gap-0.5 text-[10px] font-medium",
                trend > 0 ? "text-emerald-600" : "text-red-500"
              )}>
                {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {trend > 0 ? "+" : ""}{trend.toFixed(0)}%
              </span>
            )}
          </div>

          {/* Factor breakdown */}
          {Object.keys(factors).length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border">
              {Object.entries(factors).map(([factor, points]) => (
                <div key={factor} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground capitalize">{factor.replace(/_/g, " ")}</span>
                  <span className={cn("font-medium", points > 0 ? "text-emerald-600" : points < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {points > 0 ? "+" : ""}{points}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history && history.length > 1 && (
            <div className="pt-1 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Recent History</p>
              {history.slice(0, 3).map((h, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                  <span className="font-medium">{h.score}pts / {Math.round(h.win_probability ?? 0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
