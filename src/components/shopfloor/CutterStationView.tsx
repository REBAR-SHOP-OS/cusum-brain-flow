import { useState } from "react";
import { StationHeader } from "./StationHeader";
import { CutEngine } from "./CutEngine";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { manageMachine } from "@/lib/manageMachineService";
import { manageInventory } from "@/lib/inventoryService";
import { useToast } from "@/hooks/use-toast";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
import { useInventoryData } from "@/hooks/useInventoryData";
import type { LiveMachine } from "@/types/machine";
import type { StationItem } from "@/hooks/useStationData";

interface CutterStationViewProps {
  machine: LiveMachine;
  items: StationItem[];
  canWrite: boolean;
}

export function CutterStationView({ machine, items, canWrite }: CutterStationViewProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const currentItem = items[currentIndex] || null;
  const { getMaxBars } = useMachineCapabilities(machine.model, "cut");
  const cutPlanId = currentItem?.cut_plan_id || null;
  const barCode = currentItem?.bar_code;

  const { lots } = useInventoryData(cutPlanId, barCode);

  const remaining = items.filter((i) => i.completed_pieces < i.total_pieces).length;

  const handleLockAndStart = async (stockLength: number, bars: number) => {
    if (!currentItem) return;
    try {
      setIsRunning(true);

      // 1. Start the machine run
      await manageMachine({
        action: "start-run",
        machineId: machine.id,
        process: "cut",
        barCode: currentItem.bar_code,
        qty: bars,
        notes: `Stock: ${stockLength}mm | Mark: ${currentItem.mark_number || "—"} | Length: ${currentItem.cut_length_mm}mm`,
      });

      // 2. Consume inventory on start — find best source
      const bestLot = lots.find((l) => l.qty_on_hand - l.qty_reserved >= bars);
      if (bestLot) {
        try {
          await manageInventory({
            action: "consume-on-start",
            machineRunId: machine.current_run_id || undefined,
            cutPlanItemId: currentItem.id,
            barCode: currentItem.bar_code,
            qty: bars,
            sourceType: bestLot.source === "remnant" ? "remnant" : "lot",
            sourceId: bestLot.id,
            stockLengthMm: stockLength,
          });
        } catch (invErr: any) {
          console.warn("Inventory consumption warning:", invErr.message);
        }
      }

      toast({ title: "Machine started", description: `Cutting ${currentItem.mark_number || "item"}` });
    } catch (err: any) {
      toast({ title: "Start failed", description: err.message, variant: "destructive" });
      setIsRunning(false);
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
          No items queued to this machine
        </div>
      </div>
    );
  }

  const maxBars = getMaxBars(currentItem.bar_code) || 10;

  return (
    <div className="flex flex-col h-full">
      {/* Header with bar size + mark/dwg in center */}
      <StationHeader
        machineName={machine.name}
        machineModel={machine.model}
        barSizeRange={currentItem.bar_code}
        markNumber={currentItem.mark_number}
        drawingRef={currentItem.drawing_ref}
        remainingCount={remaining}
        canWrite={canWrite}
        showBedsSuffix={false}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — large cut length display */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 bg-muted/20">
          {/* Large cut length display */}
          <Card className="bg-card border border-border w-full max-w-lg">
            <CardContent className="py-10 px-6 text-center">
              <p className="text-7xl sm:text-8xl lg:text-9xl font-black font-mono text-foreground leading-none tracking-tight">
                {currentItem.cut_length_mm}
              </p>
              <p className="text-sm text-primary tracking-[0.35em] uppercase mt-3 font-bold">
                MM Cut Length
              </p>
            </CardContent>
          </Card>

          {/* ASA shape diagram if bend type */}
          {currentItem.bend_type === "bend" && currentItem.asa_shape_code && (
            <Card className="bg-card border border-border w-full max-w-lg">
              <CardContent className="py-6 px-4 flex justify-center">
                <AsaShapeDiagram
                  shapeCode={currentItem.asa_shape_code}
                  dimensions={currentItem.bend_dimensions}
                  size="md"
                />
              </CardContent>
            </Card>
          )}

          {/* Pieces progress */}
          <div className="text-center text-xs text-muted-foreground font-mono">
            {currentItem.completed_pieces} / {currentItem.total_pieces} PCS COMPLETED
          </div>

          {/* Item navigation */}
          <div className="flex items-center gap-4">
            <button
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              ‹
            </button>
            <span className="text-sm text-muted-foreground font-mono min-w-[60px] text-center">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={currentIndex >= items.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            >
              ›
            </button>
          </div>
        </div>

        {/* Right panel — dark CUT ENGINE */}
        <div className="w-80 lg:w-96 bg-slate-900 text-white p-5 flex flex-col gap-4 overflow-y-auto">
          <CutEngine
            barCode={currentItem.bar_code}
            maxBars={maxBars}
            onLockAndStart={handleLockAndStart}
            isRunning={isRunning || machine.status === "running"}
            canWrite={canWrite}
            darkMode
          />
        </div>
      </div>
    </div>
  );
}
