import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface Props {
  lead: LeadWithCustomer;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onClick: () => void;
  nextStageLabel?: string;
  prevStageLabel?: string;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableLeadCard({ lead, onSwipeRight, onSwipeLeft, onClick, nextStageLabel, prevStageLabel }: Props) {
  const [swiped, setSwiped] = useState(false);
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);
  const rightOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);

  const meta = lead.metadata as Record<string, unknown> | null;
  const revenue = (meta?.odoo_revenue as number) || lead.expected_value || 0;
  const customerName = lead.customers?.company_name || lead.customers?.name || null;
  const winProb = lead.win_prob_score as number | null;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (swiped) return;
    if (info.offset.x > SWIPE_THRESHOLD && nextStageLabel) {
      setSwiped(true);
      setTimeout(() => { onSwipeRight(); setSwiped(false); }, 200);
    } else if (info.offset.x < -SWIPE_THRESHOLD && prevStageLabel) {
      setSwiped(true);
      setTimeout(() => { onSwipeLeft(); setSwiped(false); }, 200);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Background labels */}
      <motion.div
        className="absolute inset-y-0 left-0 flex items-center px-3 text-xs font-medium text-emerald-600"
        style={{ opacity: rightOpacity }}
      >
        <ChevronRight className="w-4 h-4 mr-1" />
        {nextStageLabel}
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-amber-600"
        style={{ opacity: leftOpacity }}
      >
        {prevStageLabel}
        <ChevronLeft className="w-4 h-4 ml-1" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        style={{ x, scale }}
        onClick={onClick}
        className="relative bg-background border border-border rounded-md p-3 cursor-pointer touch-pan-y"
      >
        <p className="font-semibold text-sm leading-tight line-clamp-1">{lead.title}</p>
        {customerName && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{customerName}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {winProb != null && winProb > 0 && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0 rounded",
                winProb >= 60 ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
              )}>
                <Brain className="w-2.5 h-2.5" />
                {Math.round(winProb)}%
              </span>
            )}
          </div>
          {revenue > 0 && (
            <span className="text-xs font-medium text-foreground">
              ${revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
