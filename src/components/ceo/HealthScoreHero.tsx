import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Brain, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "./AnimatedCounter";
import { useState } from "react";
import { ExplainPanel } from "./ExplainPanel";
import { mockAIExplainer } from "./mockData";

interface HealthScoreHeroProps {
  score: number;
  drivers: { label: string; score: number; icon: React.ReactNode }[];
}

function getHealthGradient(score: number) {
  if (score >= 70) return "from-emerald-500/20 to-emerald-500/5";
  if (score >= 40) return "from-amber-500/20 to-amber-500/5";
  return "from-red-500/20 to-red-500/5";
}

function getHealthColor(score: number) {
  if (score >= 70) return "hsl(var(--success))";
  if (score >= 40) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

export function HealthScoreHero({ score, drivers }: HealthScoreHeroProps) {
  const [showExplain, setShowExplain] = useState(false);
  const dashArray = 2 * Math.PI * 58;
  const dashOffset = dashArray - (score / 100) * dashArray;
  const color = getHealthColor(score);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative rounded-2xl border border-border/50 overflow-hidden",
          "bg-gradient-to-br", getHealthGradient(score),
          "backdrop-blur-xl p-6"
        )}
      >
        {/* Glow effect */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: color }} />

        <div className="flex items-center gap-8 flex-wrap">
          {/* Score Ring */}
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
              <circle cx="70" cy="70" r="58" fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth="8" />
              <motion.circle
                cx="70" cy="70" r="58" fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={dashArray}
                initial={{ strokeDashoffset: dashArray }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedCounter value={score} className="text-3xl font-black tabular-nums" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Health</span>
            </div>
          </div>

          {/* Drivers */}
          <div className="flex-1 min-w-[200px] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Business Health Score</h2>
              <button
                onClick={() => setShowExplain(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <Brain className="w-3.5 h-3.5" />
                Explain Score
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {drivers.map((d) => (
                <motion.div
                  key={d.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {d.icon}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{d.label}</span>
                  </div>
                  <AnimatedCounter value={d.score} className="text-xl font-bold tabular-nums" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <ExplainPanel
        open={showExplain}
        onClose={() => setShowExplain(false)}
        data={mockAIExplainer}
        title="Business Health Score"
      />
    </>
  );
}
