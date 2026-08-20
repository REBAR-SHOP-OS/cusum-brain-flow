import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Brain, Zap, ArrowRight, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import type { AIExplainerResponse } from "./types";
import { cn } from "@/lib/utils";

interface ExplainPanelProps {
  open: boolean;
  onClose: () => void;
  data: AIExplainerResponse;
  title: string;
}

const impactColors = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  med: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-primary/40 bg-primary/10 text-primary",
};

export function ExplainPanel({ open, onClose, data, title }: ExplainPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px] bg-card/95 backdrop-blur-xl border-border/50">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            AI Analysis: {title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* What Changed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What Changed</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{data.what_changed}</p>
          </motion.div>

          {/* Top Drivers */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Drivers</span>
            </div>
            <div className="space-y-1.5">
              {data.top_drivers.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-primary font-mono text-xs mt-0.5">{i + 1}.</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recommended Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recommended Actions</span>
            </div>
            {data.recommended_actions.map((action, i) => (
              <div key={i} className={cn("rounded-lg border p-3 space-y-1.5", impactColors[action.impact])}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{action.title}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {action.impact} impact
                  </Badge>
                </div>
                <p className="text-xs opacity-70">Assign to: {action.owner_suggestion}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
