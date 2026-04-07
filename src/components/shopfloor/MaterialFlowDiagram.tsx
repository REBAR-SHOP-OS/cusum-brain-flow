import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Scissors,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  ArrowRight,
  Flame,
} from "lucide-react";

interface PhaseCount {
  phase: string;
  count: number;
}

const FLOW_STAGES = [
  { phase: "queued", label: "POOL", sublabel: "Awaiting Cutter", icon: Layers, color: "text-muted-foreground", border: "border-border", bg: "bg-muted/50" },
  { phase: "cutting", label: "CUTTER", sublabel: "Active Cutting", icon: Scissors, color: "text-blue-500", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  { phase: "cut_done", label: "POOL", sublabel: "Awaiting Bender", icon: Flame, color: "text-orange-500", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  { phase: "bending", label: "BENDER", sublabel: "Active Bending", icon: RotateCcw, color: "text-orange-500", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  { phase: "clearance", label: "QC", sublabel: "Clearance", icon: ShieldCheck, color: "text-primary", border: "border-primary/30", bg: "bg-primary/10" },
  { phase: "complete", label: "DISPATCH", sublabel: "Ready", icon: PackageCheck, color: "text-success", border: "border-success/30", bg: "bg-success/10" },
];

export function MaterialFlowDiagram() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: phaseCounts = [] } = useQuery({
    queryKey: ["material-flow-counts"],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const phases = ["queued", "cutting", "cut_done", "bending", "clearance", "complete"];
      const counts: PhaseCount[] = [];
      for (const phase of phases) {
        const { count, error } = await supabase
          .from("cut_plan_items")
          .select("*", { count: "exact", head: true })
          .eq("phase", phase);
        counts.push({ phase, count: error ? 0 : (count || 0) });
      }
      return counts;
    },
  });

  const getCount = (phase: string) => phaseCounts.find((p) => p.phase === phase)?.count || 0;
  const totalInFlight = phaseCounts.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-primary">
            Material Flow
          </h3>
        </div>
        <button
          onClick={() => navigate("/shopfloor/pool")}
          className="text-[10px] font-bold tracking-widest uppercase text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          View Pool <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Flow pipeline */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {FLOW_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const count = getCount(stage.phase);
          const isActive = count > 0;

          return (
            <div key={stage.phase} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigate(`/shopfloor/pool?phase=${stage.phase}`)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 transition-all min-w-[72px] ${
                  isActive
                    ? `${stage.border} ${stage.bg} shadow-sm`
                    : "border-border/40 bg-card/50"
                } hover:scale-105 active:scale-95`}
              >
                <Icon className={`w-4 h-4 ${isActive ? stage.color : "text-muted-foreground/40"}`} />
                <span className={`text-lg font-black font-mono leading-none ${isActive ? stage.color : "text-muted-foreground/30"}`}>
                  {count}
                </span>
                <span className={`text-[7px] tracking-wider uppercase font-bold leading-tight text-center ${
                  isActive ? "text-foreground" : "text-muted-foreground/40"
                }`}>
                  {stage.label}
                </span>
              </button>
              {idx < FLOW_STAGES.length - 1 && (
                <div className="flex flex-col items-center shrink-0">
                  <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary badge */}
      <div className="flex items-center justify-center">
        <Badge variant="outline" className="text-[10px] tracking-widest font-mono">
          {totalInFlight} ITEMS IN PRODUCTION
        </Badge>
      </div>
    </div>
  );
}
