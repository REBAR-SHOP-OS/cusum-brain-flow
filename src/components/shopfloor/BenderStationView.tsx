import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StationHeader } from "./StationHeader";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { BendingSchematic } from "./BendingSchematic";
import { ForemanPanel } from "./ForemanPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
import { useForemanBrain } from "@/hooks/useForemanBrain";
import { recordCompletion } from "@/lib/foremanLearningService";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ForemanContext } from "@/lib/foremanBrain";
import type { LiveMachine } from "@/types/machine";
import type { StationItem } from "@/hooks/useStationData";

interface BenderStationViewProps {
  machine: LiveMachine;
  items: StationItem[];
  canWrite: boolean;
  initialIndex?: number;
}

export function BenderStationView({ machine, items, canWrite, initialIndex = 0 }: BenderStationViewProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [submitting, setSubmitting] = useState(false);

  const currentItem = items[currentIndex] || null;
  const cutPlanId = currentItem?.cut_plan_id || null;
  const barCode = currentItem?.bar_code;

  const { wipBatches, lots, floorStock } = useInventoryData(cutPlanId, barCode);
  const { getMaxBars } = useMachineCapabilities(machine.model, "bend");
  const maxBars = currentItem ? (getMaxBars(currentItem.bar_code) || null) : null;

  // Batch size per DONE press based on bar size
  const getBatchSize = (barCode: string): number => {
    const num = parseInt(barCode.replace(/\D/g, "")) || 0;
    if (num <= 10) return 6;
    if (num <= 15) return 4;
    if (num <= 20) return 2;
    return 1;
  };

  const batchSize = currentItem ? getBatchSize(currentItem.bar_code) : 1;
  const bendCompleted = currentItem?.bend_completed_pieces ?? currentItem?.completed_pieces ?? 0;
  const progress = currentItem
    ? Math.round((bendCompleted / currentItem.total_pieces) * 100)
    : 0;

  // ── Foreman Brain context ──
  const foremanContext: ForemanContext | null = currentItem
    ? {
        module: "bend",
        machineId: machine.id,
        machineName: machine.name,
        machineModel: machine.model,
        machineStatus: machine.status,
        machineType: machine.type,
        currentItem,
        items,
        lots,
        floorStock,
        wipBatches,
        maxBars,
        selectedStockLength: 12000,
        currentIndex,
        canWrite,
      }
    : null;

  const foreman = useForemanBrain({ context: foremanContext });

  const isMarkComplete = currentItem ? bendCompleted >= currentItem.total_pieces : false;

  const handleDone = async () => {
    if (!currentItem || submitting || isMarkComplete) return;
    setSubmitting(true);
    try {
      const newCount = Math.min(bendCompleted + batchSize, currentItem.total_pieces);
      // Update bend_completed_pieces and set phase to 'bending'
      const { error } = await supabase
        .from("cut_plan_items")
        .update({ bend_completed_pieces: newCount, phase: "bending" } as any)
        .eq("id", currentItem.id);

      if (error) throw error;

      const added = newCount - bendCompleted;
      toast({ title: `+${added} Confirmed`, description: `${newCount} / ${currentItem.total_pieces} pieces` });

      // Record completion learning if mark done
      if (newCount >= currentItem.total_pieces) {
        recordCompletion("bend", machine.id, currentItem.bar_code, {
          mark: currentItem.mark_number,
          shape_code: currentItem.asa_shape_code,
          total_pieces: currentItem.total_pieces,
        });
        // Auto-advance
        if (currentIndex < items.length - 1) {
          setTimeout(() => setCurrentIndex((i) => i + 1), 800);
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // NOTE: handleConsumeOnBendStart is reserved for future WIP consumption
  // integration when bender machine runs are tracked via manage-machine.

  if (!currentItem) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader
          machineName={machine.name}
          machineModel={machine.model}
          canWrite={canWrite}
          showBedsSuffix={true}
        />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No items queued to this bender
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header with mark/dwg info in center */}
      <StationHeader
        machineName={machine.name}
        machineModel={machine.model}
        markNumber={currentItem.mark_number}
        drawingRef={currentItem.drawing_ref}
        canWrite={canWrite}
        showBedsSuffix={false}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* ── FOREMAN BRAIN PANEL ── */}
        <div className="mb-4">
          <ForemanPanel foreman={foreman} />
        </div>

        {/* Shape code badge */}
        <div className="flex justify-start mb-4">
          <Badge className="bg-muted text-foreground border border-border font-mono text-sm px-3 py-1">
            {currentItem.asa_shape_code || "—"}
          </Badge>
        </div>

        {/* Large shape diagram area */}
        <div className="flex justify-center py-4 mb-6">
          {currentItem.asa_shape_code ? (
            <AsaShapeDiagram
              shapeCode={currentItem.asa_shape_code}
              dimensions={currentItem.bend_dimensions}
              size="lg"
            />
          ) : (
            <div className="w-64 h-40 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
              No shape assigned
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Bar Size</p>
              <p className="text-2xl sm:text-3xl font-black text-foreground">{currentItem.bar_code}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Finished Progress</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl sm:text-4xl font-black text-primary">{currentItem.bend_completed_pieces ?? 0}</span>
                <span className="text-lg text-muted-foreground">/ {currentItem.total_pieces}</span>
              </div>
              <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-0.5">Pieces Verified</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border relative">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">Mark ID</p>
              <p className="text-2xl sm:text-3xl font-black text-foreground">{currentItem.mark_number || "—"}</p>
            </CardContent>
            <div className="absolute top-3 right-3">
              <div
                className="w-8 h-8 rounded-full border-[3px] border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${progress}%, transparent ${progress}%)`
                }}
              >
                <span className="bg-card rounded-full w-5 h-5 flex items-center justify-center">{progress}%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Bending schematic */}
        <BendingSchematic dimensions={currentItem.bend_dimensions} />
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          {(() => {
            const totalBatches = Math.ceil((currentItem?.total_pieces || 1) / batchSize);
            const currentBatch = Math.min(Math.floor(bendCompleted / batchSize) + 1, totalBatches);
            return (
              <>
                <div className="flex flex-col items-start mr-3">
                  <span className="text-[9px] text-muted-foreground tracking-wider uppercase">Batch ×{batchSize}</span>
                  <span className="text-[9px] text-muted-foreground tracking-wider uppercase">Unit {currentBatch} / {totalBatches}</span>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentIndex <= 0 || submitting} onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xl font-bold text-foreground min-w-[40px] text-center">{currentBatch}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentIndex >= items.length - 1 || submitting} onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            );
          })()}
        </div>

        <Button
          size="lg"
          className="flex-1 ml-4 h-14 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-lg"
          disabled={!canWrite || submitting || isMarkComplete}
          onClick={handleDone}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isMarkComplete ? (
            <>
              <Check className="w-5 h-5" />
              <span className="text-xl font-black">COMPLETE</span>
            </>
          ) : (
            <>
              <span className="text-xl font-black">DONE</span>
              <span className="text-xs opacity-80">CONFIRMED +{batchSize} {batchSize === 1 ? "PIECE" : "PIECES"}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
