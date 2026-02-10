import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Flame, Eye, Calendar, Clock, User, ChevronRight,
  DollarSign, Settings, TrendingUp, Truck, CheckCircle2,
  AlarmClock, Forward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockExceptions } from "./mockData";
import type { ExceptionItem } from "./types";

type Priority = "do-now" | "review-today" | "watch-week";

function classifyPriority(exc: ExceptionItem): Priority {
  if (exc.severity === "critical") return "do-now";
  const ageNum = parseInt(exc.age);
  if (!isNaN(ageNum) && exc.age.includes("d") && ageNum > 30) return "do-now";
  if (exc.severity === "warning") return "review-today";
  return "watch-week";
}

const categoryIcons = { cash: DollarSign, ops: Settings, sales: TrendingUp, delivery: Truck };

const priorityConfig = {
  "do-now": { label: "Do Now", icon: Flame, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  "review-today": { label: "Review Today", icon: Eye, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  "watch-week": { label: "Watch This Week", icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
};

export function DailyAssignments() {
  const [tab, setTab] = useState<Priority>("do-now");

  const assignments = mockExceptions.map((exc) => ({
    ...exc,
    priority: classifyPriority(exc),
  }));

  const counts = {
    "do-now": assignments.filter((a) => a.priority === "do-now").length,
    "review-today": assignments.filter((a) => a.priority === "review-today").length,
    "watch-week": assignments.filter((a) => a.priority === "watch-week").length,
  };

  const filtered = assignments.filter((a) => a.priority === tab);
  const config = priorityConfig[tab];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden"
    >
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Intelligent Daily Assignments
          </h2>
          <Badge variant="secondary" className="text-xs">
            {assignments.length} items
          </Badge>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Priority)}>
          <TabsList className="bg-muted/30 border border-border/50">
            {(["do-now", "review-today", "watch-week"] as Priority[]).map((p) => {
              const pc = priorityConfig[p];
              return (
                <TabsTrigger key={p} value={p} className="text-xs gap-1.5">
                  <pc.icon className={cn("w-3 h-3", pc.color)} />
                  {pc.label}
                  {counts[p] > 0 && (
                    <span className={cn(
                      "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                      p === "do-now" ? "bg-destructive/20 text-destructive" :
                      p === "review-today" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                      "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    )}>
                      {counts[p]}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5 pt-3 space-y-2 max-h-[340px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center text-sm text-muted-foreground"
            >
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500/50" />
              No items in this category
            </motion.div>
          ) : (
            filtered.map((exc, i) => {
              const Icon = categoryIcons[exc.category];
              return (
                <motion.div
                  key={exc.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-colors",
                    config.border, config.bg,
                    "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("p-2 rounded-lg shrink-0", config.bg)}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{exc.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {exc.age}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {exc.owner}
                        </span>
                        {exc.customer && (
                          <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                            {exc.customer}
                          </span>
                        )}
                        {exc.value && (
                          <span className="text-[10px] font-medium text-foreground">
                            ${exc.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* One-tap actions */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {exc.actions[0] && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-[10px] px-2.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({ title: exc.actions[0].label, description: `Action triggered for: ${exc.title}` });
                        }}
                      >
                        {exc.actions[0].label}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delegate"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast({ title: "Delegated", description: `"${exc.title}" delegated to ${exc.owner}` });
                      }}
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Snooze"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast({ title: "Snoozed", description: `"${exc.title}" snoozed for 4 hours` });
                      }}
                    >
                      <AlarmClock className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
