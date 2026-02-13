import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Scissors,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  Truck,
  Flame,
  Package,
} from "lucide-react";

type PoolPhase = "queued" | "cutting" | "cut_done" | "bending" | "clearance" | "complete";

interface PoolItem {
  id: string;
  bar_code: string;
  mark_number: string | null;
  drawing_ref: string | null;
  bend_type: string;
  phase: string;
  total_pieces: number;
  completed_pieces: number;
  bend_completed_pieces: number;
  asa_shape_code: string | null;
  cut_length_mm: number;
  plan_name: string;
  project_name: string | null;
}

const PHASE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  queued: { label: "POOL → CUTTER", icon: Layers, color: "text-muted-foreground", bg: "bg-muted" },
  cutting: { label: "CUTTING", icon: Scissors, color: "text-blue-500", bg: "bg-blue-500/10" },
  cut_done: { label: "POOL → BENDER", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
  bending: { label: "BENDING", icon: RotateCcw, color: "text-orange-500", bg: "bg-orange-500/10" },
  clearance: { label: "CLEARANCE", icon: ShieldCheck, color: "text-primary", bg: "bg-primary/10" },
  complete: { label: "COMPLETE → DISPATCH", icon: PackageCheck, color: "text-success", bg: "bg-success/10" },
};

export default function PoolView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pool-view-items"],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(name, project_name)")
        .in("phase", ["queued", "cutting", "cut_done", "bending", "clearance", "complete"])
        .order("phase")
        .limit(500);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        bar_code: item.bar_code,
        mark_number: item.mark_number,
        drawing_ref: item.drawing_ref,
        bend_type: item.bend_type,
        phase: item.phase,
        total_pieces: item.total_pieces,
        completed_pieces: item.completed_pieces || 0,
        bend_completed_pieces: item.bend_completed_pieces || 0,
        asa_shape_code: item.asa_shape_code,
        cut_length_mm: item.cut_length_mm,
        plan_name: item.cut_plans?.name || "",
        project_name: item.cut_plans?.project_name || null,
      })) as PoolItem[];
    },
  });

  // Group by phase
  const phases: PoolPhase[] = ["queued", "cutting", "cut_done", "bending", "clearance", "complete"];
  const grouped = new Map<string, PoolItem[]>();
  for (const phase of phases) {
    grouped.set(phase, items.filter((i) => i.phase === phase));
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-black italic uppercase tracking-wide text-foreground">
              Material Pool
            </h1>
            <p className="text-[9px] tracking-[0.2em] uppercase text-primary">
              Live staging area — all items by production phase
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {items.length} ITEMS
        </Badge>
      </header>

      {/* Flow Diagram Summary */}
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {phases.map((phase, idx) => {
            const config = PHASE_CONFIG[phase];
            const count = grouped.get(phase)?.length || 0;
            const Icon = config.icon;
            return (
              <div key={phase} className="flex items-center gap-1 shrink-0">
                <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-border ${config.bg} min-w-[80px]`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className={`text-xl font-black font-mono ${config.color}`}>{count}</span>
                  <span className="text-[8px] tracking-wider uppercase text-muted-foreground font-bold text-center leading-tight">
                    {config.label}
                  </span>
                </div>
                {idx < phases.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Lanes */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            phases.map((phase) => {
              const phaseItems = grouped.get(phase) || [];
              if (phaseItems.length === 0) return null;
              const config = PHASE_CONFIG[phase];
              const Icon = config.icon;

              return (
                <section key={phase}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black tracking-wider uppercase text-foreground">
                        {config.label}
                      </h2>
                      <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
                        {phaseItems.length} item{phaseItems.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {phaseItems.map((item) => {
                      const isBend = item.bend_type === "bend";
                      const progress = item.total_pieces > 0
                        ? Math.round(
                            ((phase === "bending" || phase === "clearance" || phase === "complete")
                              ? item.bend_completed_pieces
                              : item.completed_pieces
                            ) / item.total_pieces * 100
                          )
                        : 0;

                      return (
                        <Card
                          key={item.id}
                          className="border-border hover:border-primary/30 transition-all group relative overflow-hidden"
                        >
                          {/* Phase accent */}
                          <div className={`absolute top-0 left-0 right-0 h-1 ${
                            isBend ? "bg-orange-500" : "bg-blue-500"
                          }`} />
                          <CardContent className="p-4 pt-5 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-lg font-black text-foreground tracking-tight">
                                  {item.mark_number || "—"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {item.bar_code} • {item.cut_length_mm}mm
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[9px] tracking-wider ${
                                  isBend
                                    ? "border-orange-500/30 text-orange-500"
                                    : "border-blue-500/30 text-blue-500"
                                }`}
                              >
                                {isBend ? "BEND" : "STRAIGHT"}
                              </Badge>
                            </div>

                            {item.project_name && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {item.project_name}
                              </p>
                            )}

                            {/* Progress */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="uppercase tracking-wider">Progress</span>
                                <span className="font-mono font-bold">{progress}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    progress >= 100 ? "bg-success" : "bg-primary"
                                  }`}
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {phase === "bending" || phase === "clearance" || phase === "complete"
                                  ? item.bend_completed_pieces
                                  : item.completed_pieces
                                } / {item.total_pieces} PCS
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
