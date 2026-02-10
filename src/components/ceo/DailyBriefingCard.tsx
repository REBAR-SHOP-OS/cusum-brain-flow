import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight, Sun, Moon, CloudSun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

function getGreetingIcon() {
  const h = new Date().getHours();
  if (h < 12) return <Sun className="w-4 h-4 text-amber-400" />;
  if (h < 17) return <CloudSun className="w-4 h-4 text-orange-400" />;
  return <Moon className="w-4 h-4 text-indigo-400" />;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DailyBriefingCard() {
  const navigate = useNavigate();

  const { data: briefing, isLoading } = useQuery({
    queryKey: ["ceo-daily-briefing", format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      try {
        const { data } = await supabase.functions.invoke("daily-summary", {
          body: { date: format(new Date(), "yyyy-MM-dd") },
        });
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const takeaways = briefing?.highlights?.slice(0, 3) || briefing?.key_takeaways?.slice(0, 3) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
    >
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getGreetingIcon()}
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Daily Briefing
              </h2>
              <Badge variant="secondary" className="text-[10px]">
                {format(new Date(), "MMM d")}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-primary"
              onClick={() => navigate("/daily-summarizer")}
            >
              Full Briefing <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : takeaways.length > 0 ? (
            <div className="space-y-2">
              {takeaways.map((t: string, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                {getGreeting()}! Your daily briefing will appear here once data is available.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
