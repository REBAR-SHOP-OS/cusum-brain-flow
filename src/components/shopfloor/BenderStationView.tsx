import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StationHeader } from "./StationHeader";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { BendingSchematic } from "./BendingSchematic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useInventoryData } from "@/hooks/useInventoryData";
import { manageInventory } from "@/lib/inventoryService";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

  const { wipBatches } = useInventoryData(cutPlanId, barCode);

  const progress = currentItem
    ? Math.round((currentItem.completed_pieces / currentItem.total_pieces) * 100)
    : 0;

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

  // Consume WIP or raw stock when bender starts
  const handleConsumeOnBendStart = async () => {
    if (!currentItem) return;
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

        {/* Stats row — 3 cards matching reference */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">
                Bar Size
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground">
                {currentItem.bar_code}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">
                Finished Progress
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl sm:text-4xl font-black text-primary">
                  {currentItem.completed_pieces}
                </span>
                <span className="text-lg text-muted-foreground">
                  / {currentItem.total_pieces}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-0.5">
                Pieces Verified
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border relative">
            <CardContent className="p-4 text-center">
              <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase mb-1">
                Mark ID
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground">
                {currentItem.mark_number || "—"}
              </p>
            </CardContent>
            {/* Progress indicator circle */}
            <div className="absolute top-3 right-3">
              <div 
                className="w-8 h-8 rounded-full border-[3px] border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${progress}%, transparent ${progress}%)`
                }}
              >
                <span className="bg-card rounded-full w-5 h-5 flex items-center justify-center">
                  {progress}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Bending schematic — dimension values */}
        <BendingSchematic dimensions={currentItem.bend_dimensions} />
      </div>

      {/* Bottom bar: batch navigation + DONE button */}
      <div className="border-t border-border p-4 flex items-center justify-between bg-card">
        {/* Batch navigation */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-start mr-3">
            <span className="text-[9px] text-muted-foreground tracking-wider uppercase">Batch</span>
            <span className="text-[9px] text-muted-foreground tracking-wider uppercase">
              Unit {currentIndex + 1}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentIndex <= 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xl font-bold text-foreground min-w-[40px] text-center">
            {currentIndex + 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentIndex >= items.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Large DONE button */}
        <Button
          size="lg"
          className="flex-1 ml-4 h-14 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg rounded-lg"
          disabled={!canWrite || submitting}
          onClick={handleDone}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="text-xl font-black">DONE</span>
              <span className="text-xs opacity-80">CONFIRMED +1 BARS</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
