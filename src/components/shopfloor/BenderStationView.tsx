import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StationHeader } from "./StationHeader";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { BendingSchematic } from "./BendingSchematic";
import { ProductionProgress } from "./ProductionProgress";
import { InventoryStatusPanel } from "./InventoryStatusPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useInventoryData } from "@/hooks/useInventoryData";
import { manageInventory } from "@/lib/inventoryService";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { LiveMachine } from "@/types/machine";
import type { StationItem } from "@/hooks/useStationData";

interface BenderStationViewProps {
  machine: LiveMachine;
  items: StationItem[];
  canWrite: boolean;
}

export function BenderStationView({ machine, items, canWrite }: BenderStationViewProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const currentItem = items[currentIndex] || null;
  const cutPlanId = currentItem?.cut_plan_id || null;
  const barCode = currentItem?.bar_code;

  const {
    reservations,
    lots,
    wipBatches,
    scrapRecords,
    summary,
  } = useInventoryData(cutPlanId, barCode);

  const remnants = lots.filter((l) => l.source === "remnant");

  const handleDone = async () => {
    if (!currentItem || submitting) return;
    setSubmitting(true);
    try {
      const newCount = currentItem.completed_pieces + 1;
      const { error } = await supabase
        .from("cut_plan_items")
        .update({ completed_pieces: newCount })
        .eq("id", currentItem.id);

      if (error) throw error;

      toast({ title: `+1 Confirmed`, description: `${newCount} / ${currentItem.total_pieces} pieces` });

      // Auto-advance if complete
      if (newCount >= currentItem.total_pieces && currentIndex < items.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Consume WIP or raw stock when bender starts on an item
  const handleConsumeOnBendStart = async () => {
    if (!currentItem) return;
    // Try WIP first, then raw lots
    const wipSource = wipBatches.find(
      (w) => w.bar_code === currentItem.bar_code && w.qty_available > 0
    );
    if (wipSource) {
      try {
        await manageInventory({
          action: "consume-on-start",
          machineRunId: machine.current_run_id || undefined,
          cutPlanItemId: currentItem.id,
          barCode: currentItem.bar_code,
          qty: 1,
          sourceType: "wip",
          sourceId: wipSource.id,
        });
        toast({ title: "WIP consumed", description: "1 piece from cut output" });
      } catch (err: any) {
        console.warn("WIP consumption warning:", err.message);
      }
    }
  };

  if (!currentItem) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader machineName={machine.name} machineModel={machine.model} canWrite={canWrite} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No items queued to this bender
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        machineName={machine.name}
        machineModel={machine.model}
        markNumber={currentItem.mark_number}
        drawingRef={currentItem.drawing_ref}
        projectName={currentItem.project_name}
        canWrite={canWrite}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          {/* Shape diagram */}
          <div className="flex justify-center">
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
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground tracking-wider uppercase">Bar Size</p>
                <p className="text-xl font-bold font-mono">{currentItem.bar_code}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground tracking-wider uppercase">Progress</p>
                <ProductionProgress
                  completed={currentItem.completed_pieces}
                  total={currentItem.total_pieces}
                  size="sm"
                />
                <p className="text-[10px] text-muted-foreground font-mono">
                  {currentItem.completed_pieces} / {currentItem.total_pieces} PCS
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground tracking-wider uppercase">Mark ID</p>
                <p className="text-xl font-bold font-mono">{currentItem.mark_number || "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Bending schematic */}
          <BendingSchematic dimensions={currentItem.bend_dimensions} />
        </div>

        {/* Right panel — inventory status */}
        <div className="w-72 lg:w-80 border-l border-border p-4 overflow-y-auto">
          <InventoryStatusPanel
            summary={summary}
            reservations={reservations}
            remnants={remnants}
            scrapRecords={scrapRecords}
            barCode={currentItem.bar_code}
          />
        </div>
      </div>

      {/* Bottom bar: navigation + DONE */}
      <div className="border-t border-border p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={currentIndex <= 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono text-muted-foreground min-w-[60px] text-center">
            {currentIndex + 1} / {items.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={currentIndex >= items.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button
          size="lg"
          className="gap-2 px-8 bg-success hover:bg-success/90 text-success-foreground font-bold"
          disabled={!canWrite || submitting}
          onClick={handleDone}
        >
          <Check className="w-5 h-5" />
          DONE
          <Badge variant="outline" className="ml-1 text-[10px] border-success-foreground/30 text-success-foreground">
            +1 BAR
          </Badge>
        </Button>
      </div>
    </div>
  );
}
