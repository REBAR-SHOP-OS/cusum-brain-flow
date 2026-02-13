import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Scissors,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  Flame,
  Search,
  ExternalLink,
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

const PHASES: PoolPhase[] = ["queued", "cutting", "cut_done", "bending", "clearance", "complete"];

const PHASE_CONFIG: Record<string, { label: string; shortLabel: string; icon: React.ElementType; color: string; bg: string; actionLabel?: string; actionRoute?: string; actionColor?: string }> = {
  queued:    { label: "POOL → CUTTER",       shortLabel: "POOL→CUT",  icon: Layers,      color: "text-muted-foreground", bg: "bg-muted",          actionLabel: "Open Cutter",   actionRoute: "/shopfloor/station", actionColor: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  cutting:   { label: "CUTTING",              shortLabel: "CUTTING",   icon: Scissors,    color: "text-blue-500",         bg: "bg-blue-500/10" },
  cut_done:  { label: "POOL → BENDER",        shortLabel: "POOL→BEND", icon: Flame,       color: "text-orange-500",       bg: "bg-orange-500/10",  actionLabel: "Open Bender",   actionRoute: "/shopfloor/station", actionColor: "bg-orange-500 hover:bg-orange-600 text-white" },
  bending:   { label: "BENDING",              shortLabel: "BENDING",   icon: RotateCcw,   color: "text-orange-500",       bg: "bg-orange-500/10" },
  clearance: { label: "CLEARANCE",            shortLabel: "QC",        icon: ShieldCheck,  color: "text-primary",          bg: "bg-primary/10",     actionLabel: "Review QC",     actionRoute: "/shopfloor/clearance", actionColor: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  complete:  { label: "COMPLETE → DISPATCH",  shortLabel: "DISPATCH",  icon: PackageCheck, color: "text-success",          bg: "bg-success/10",     actionLabel: "View Dispatch", actionRoute: "/deliveries", actionColor: "bg-success hover:bg-success/90 text-success-foreground" },
};

export default function PoolView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePhase = (searchParams.get("phase") as PoolPhase | null) || null;
  const [search, setSearch] = useState("");

  const setPhaseFilter = (phase: PoolPhase | null) => {
    if (phase) {
      setSearchParams({ phase });
    } else {
      setSearchParams({});
    }
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pool-view-items"],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_plan_items")
        .select("*, cut_plans!inner(name, project_name)")
        .in("phase", PHASES)
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
  const grouped = new Map<string, PoolItem[]>();
  for (const phase of PHASES) {
    grouped.set(phase, items.filter((i) => i.phase === phase));
  }

  // Determine which phases to show
  const visiblePhases = activePhase ? [activePhase] : PHASES;

  // Search filter
  const searchLower = search.toLowerCase().trim();
  const filterItem = (item: PoolItem) => {
    if (!searchLower) return true;
    return (
      (item.mark_number?.toLowerCase().includes(searchLower)) ||
      (item.bar_code?.toLowerCase().includes(searchLower)) ||
      (item.drawing_ref?.toLowerCase().includes(searchLower)) ||
      (item.project_name?.toLowerCase().includes(searchLower))
    );
  };

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

      {/* Flow Diagram Summary — clickable */}
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {PHASES.map((phase, idx) => {
            const config = PHASE_CONFIG[phase];
            const count = grouped.get(phase)?.length || 0;
            const Icon = config.icon;
            const isActive = activePhase === phase;
            return (
              <div key={phase} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setPhaseFilter(isActive ? null : phase)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all min-w-[80px] cursor-pointer ${
                    isActive
                      ? `border-primary ring-2 ring-primary/30 ${config.bg} shadow-md scale-105`
                      : `border-border ${config.bg} hover:scale-105`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className={`text-xl font-black font-mono ${config.color}`}>{count}</span>
                  <span className="text-[8px] tracking-wider uppercase text-muted-foreground font-bold text-center leading-tight">
                    {config.shortLabel}
                  </span>
                </button>
                {idx < PHASES.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-card/30 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Phase tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setPhaseFilter(null)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
              !activePhase
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            ALL ({items.length})
          </button>
          {PHASES.map((phase) => {
            const config = PHASE_CONFIG[phase];
            const count = grouped.get(phase)?.length || 0;
            const isActive = activePhase === phase;
            return (
              <button
                key={phase}
                onClick={() => setPhaseFilter(isActive ? null : phase)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {config.shortLabel} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mark, bar code, drawing..."
            className="pl-9 h-8 text-xs"
          />
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
            visiblePhases.map((phase) => {
              const allPhaseItems = grouped.get(phase) || [];
              const phaseItems = allPhaseItems.filter(filterItem);
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
                        {searchLower && phaseItems.length !== allPhaseItems.length && (
                          <span className="ml-1 text-primary">
                            (filtered from {allPhaseItems.length})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {phaseItems.length === 0 ? (
                    <div className="flex items-center justify-center py-8 border border-dashed border-border rounded-xl">
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">
                        {searchLower ? "No matches" : "0 items in this phase"}
                      </p>
                    </div>
                  ) : (
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

                              {/* Action button */}
                              {config.actionLabel && config.actionRoute && (
                                <Button
                                  size="sm"
                                  className={`w-full gap-1.5 text-[10px] font-bold tracking-wider uppercase mt-2 ${config.actionColor || ""}`}
                                  onClick={() => navigate(config.actionRoute!)}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {config.actionLabel}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
