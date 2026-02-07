import { useState } from "react";
import { StationHeader } from "./StationHeader";
import { CutEngine } from "./CutEngine";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { manageMachine } from "@/lib/manageMachineService";
import { useToast } from "@/hooks/use-toast";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
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

  const remaining = items.filter((i) => i.completed_pieces < i.total_pieces).length;

  const handleLockAndStart = async (stockLength: number, bars: number) => {
    if (!currentItem) return;
    try {
      setIsRunning(true);
      await manageMachine({
        action: "start-run",
        machineId: machine.id,
        process: "cut",
        barCode: currentItem.bar_code,
        qty: bars,
        notes: `Stock: ${stockLength}mm | Mark: ${currentItem.mark_number || "—"} | Length: ${currentItem.cut_length_mm}mm`,
      });
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
        />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No items queued to this machine
        </div>
      </div>
    );
  }

  const maxBars = getMaxBars(currentItem.bar_code) || 10;
  const barSizeRange = currentItem.bar_code;

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        machineName={machine.name}
        machineModel={machine.model}
        barSizeRange={barSizeRange}
        projectName={currentItem.project_name}
        markNumber={currentItem.mark_number}
        drawingRef={currentItem.drawing_ref}
        remainingCount={remaining}
        canWrite={canWrite}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — cut length / shape */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          {/* Item navigation */}
          <div className="flex items-center gap-4">
            <button
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              ‹
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
              disabled={currentIndex >= items.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            >
              ›
            </button>
          </div>

          {/* Large cut length display */}
          <div className="text-center">
            <p className="text-7xl sm:text-8xl font-bold font-mono text-foreground leading-none">
              {currentItem.cut_length_mm}
            </p>
            <p className="text-sm text-muted-foreground tracking-[0.3em] uppercase mt-2">
              MM Cut Length
            </p>
          </div>

          {/* ASA shape if bend */}
          {currentItem.bend_type === "bend" && currentItem.asa_shape_code && (
            <AsaShapeDiagram
              shapeCode={currentItem.asa_shape_code}
              dimensions={currentItem.bend_dimensions}
              size="md"
            />
          )}

          {/* Pieces progress */}
          <div className="text-center text-xs text-muted-foreground font-mono">
            {currentItem.completed_pieces} / {currentItem.total_pieces} PCS COMPLETED
          </div>
        </div>

        {/* Right panel — cut engine */}
        <div className="w-72 lg:w-80 border-l border-border p-4 flex flex-col justify-center">
          <CutEngine
            barCode={currentItem.bar_code}
            maxBars={maxBars}
            onLockAndStart={handleLockAndStart}
            isRunning={isRunning || machine.status === "running"}
            canWrite={canWrite}
          />
        </div>
      </div>
    </div>
  );
}
