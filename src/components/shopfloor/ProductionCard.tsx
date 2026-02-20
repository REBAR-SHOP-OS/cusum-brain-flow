import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, ArrowRight, Loader2 } from "lucide-react";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { TransferMachineDialog } from "./TransferMachineDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { StationItem } from "@/hooks/useStationData";

interface ProductionCardProps {
  item: StationItem;
  canWrite: boolean;
  isSupervisor?: boolean;
  /** Machine ID — needed for transfer dialog */
  machineId?: string;
  /** Machine type — needed for transfer dialog */
  machineType?: string;
  onClick?: () => void;
}

export function ProductionCard({
  item,
  canWrite,
  isSupervisor = false,
  machineId,
  machineType,
  onClick,
}: ProductionCardProps) {
  const isBend = item.bend_type === "bend";
  const progress = item.total_pieces > 0
    ? Math.round((item.completed_pieces / item.total_pieces) * 100)
    : 0;

  const { getShapeImageUrl } = useShapeSchematics();
  const shapeImageUrl = item.asa_shape_code ? getShapeImageUrl(item.asa_shape_code) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [resetting, setResetting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (resetting) return;
    setResetting(true);
    try {
      // On bender bed: reset bend_completed_pieces, phase back to cut_done
      // On cutter bed: reset completed_pieces, phase back to queued
      const isBenderPhase = item.phase === "bending" || item.phase === "cut_done";
      const updatePayload: Record<string, unknown> = isBenderPhase
        ? { bend_completed_pieces: 0, phase: "cut_done" }
        : { completed_pieces: 0, phase: "queued" };

      const { error } = await supabase
        .from("cut_plan_items")
        .update(updatePayload)
        .eq("id", item.id);

      if (error) throw error;

      toast({ title: "Reset", description: `${item.mark_number || "Item"} progress reset to 0` });
      queryClient.invalidateQueries({ queryKey: ["station-data"] });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleTransferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferOpen(true);
  };

  return (
    <>
      <Card
        className="relative cursor-pointer hover:shadow-lg transition-all overflow-hidden group bg-card border border-border"
        onClick={onClick}
      >
        {/* Color accent bar at bottom — full width, thicker */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-2 ${
            isBend ? "bg-warning" : "bg-primary"
          }`}
        />

        <CardContent className="p-4 pb-5 space-y-3">
          {/* Top row: MARK/DWG label + supervisor actions */}
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] text-muted-foreground font-medium tracking-[0.15em] uppercase">
                Mark / DWG
              </p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {item.mark_number || "—"}
                </span>
                {item.drawing_ref && (
                  <span className="text-xs text-muted-foreground/70 font-mono">
                    | DWG# {item.drawing_ref}
                  </span>
                )}
              </div>
            </div>

            {/* Supervisor action buttons — only visible in supervisor mode */}
            {isSupervisor && (
              <div className="flex items-center gap-1.5">
                <button
                  className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={handleReset}
                  title="Reset progress"
                  disabled={resetting}
                >
                  {resetting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  className="w-7 h-7 rounded-full border-2 border-orange-400 bg-orange-500/10 flex items-center justify-center hover:bg-orange-500/20 transition-colors"
                  onClick={handleTransferClick}
                  title="Transfer to another machine"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
                </button>
              </div>
            )}
          </div>

          {/* Bend type badge */}
          <Badge
            variant="outline"
            className={`text-[9px] font-bold tracking-wider px-2 py-0.5 ${
              isBend
                ? "bg-warning/10 text-warning border-warning/30"
                : "bg-primary/10 text-primary border-primary/30"
            }`}
          >
            {isBend ? "BEND REQ" : "STRAIGHT"}
          </Badge>

          {/* Bar size */}
          <div>
            <p className="text-[9px] text-muted-foreground font-medium tracking-[0.15em] uppercase">
              Size
            </p>
            <p className="text-sm font-bold text-foreground">{item.bar_code || "—"}</p>
          </div>

          {/* Center: shape image or length display */}
          <div className="flex items-center justify-center min-h-[110px] bg-muted/20 rounded-lg border border-border/50">
            {isBend && item.asa_shape_code && (item.phase === "bending" || item.bend_completed_pieces > 0) ? (
              shapeImageUrl ? (
                <img
                  src={shapeImageUrl}
                  alt={`Shape ${item.asa_shape_code}`}
                  className="max-w-full max-h-[100px] object-contain"
                  crossOrigin="anonymous"
                />
              ) : (
                <AsaShapeDiagram
                  shapeCode={item.asa_shape_code}
                  dimensions={item.bend_dimensions}
                  size="sm"
                />
              )
            ) : (
              <div className="text-center py-4">
                <p className="text-5xl font-black font-mono text-muted-foreground/50 tracking-tight">
                  {item.cut_length_mm}
                </p>
                <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
                  MM Length
                </p>
              </div>
            )}
          </div>

          {/* Bottom: progress label + count */}
          <div className="space-y-1 pt-1">
            <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase">
              {isBend ? "ORDER TARGET" : `PROG: ${progress}%`}
            </p>
            <p className="text-lg font-black text-foreground">
              {isBend ? item.bend_completed_pieces : item.completed_pieces} / {item.total_pieces} PCS
            </p>
          </div>

          {/* Project name micro-label */}
          {item.project_name && (
            <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase truncate pt-0.5 border-t border-border/40 mt-1">
              {item.project_name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transfer dialog */}
      {machineId && machineType && (
        <TransferMachineDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          item={item}
          machineType={machineType}
          currentMachineId={machineId}
        />
      )}
  </>
  );
}

ProductionCard.displayName = "ProductionCard";
