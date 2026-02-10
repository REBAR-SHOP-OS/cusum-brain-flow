import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, Brain, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ExplainPanel } from "./ExplainPanel";
import { mockAIExplainer } from "./mockData";

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  alertActive?: boolean;
  index: number;
  onClick?: () => void;
}

export function KpiCard({ icon, label, value, sub, alertActive, index, onClick }: KpiCardProps) {
  const [showExplain, setShowExplain] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        className={cn(
          "group relative rounded-xl border overflow-hidden cursor-pointer",
          "bg-card/80 backdrop-blur-sm transition-colors",
          alertActive
            ? "border-destructive/40 shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.15)]"
            : "border-border/50 hover:border-primary/30"
        )}
        onClick={onClick}
      >
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className={cn(
              "p-2 rounded-lg",
              alertActive ? "bg-destructive/10" : "bg-muted/50"
            )}>
              {icon}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setShowExplain(true); }}
                className="p-1 rounded-md hover:bg-muted/80 transition-colors"
                title="Explain this KPI"
              >
                <Brain className="w-3.5 h-3.5 text-primary" />
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="text-2xl font-black tabular-nums leading-none tracking-tight">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">{label}</p>
          </div>

          <div className="flex items-center gap-1.5">
            {alertActive && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
            <p className={cn("text-xs", alertActive ? "text-destructive/80" : "text-muted-foreground/70")}>{sub}</p>
          </div>
        </div>

        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>

      <ExplainPanel
        open={showExplain}
        onClose={() => setShowExplain(false)}
        data={mockAIExplainer}
        title={label}
      />
    </>
  );
}
