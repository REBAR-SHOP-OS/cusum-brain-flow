import { useState } from "react";
import { StationHeader } from "./StationHeader";
import { CutEngine } from "./CutEngine";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { ForemanPanel } from "./ForemanPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { manageMachine } from "@/lib/manageMachineService";
import { manageInventory } from "@/lib/inventoryService";
import { recordCompletion } from "@/lib/foremanLearningService";
import { useToast } from "@/hooks/use-toast";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useForemanBrain } from "@/hooks/useForemanBrain";
import { Scissors, Layers, Ruler, Hash, CheckCircle2 } from "lucide-react";
import type { ForemanContext } from "@/lib/foremanBrain";
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
  const [selectedStockLength, setSelectedStockLength] = useState(12000);

  const currentItem = items[currentIndex] || null;
  const { getMaxBars } = useMachineCapabilities(machine.model, "cut");
  const cutPlanId = currentItem?.cut_plan_id || null;
  const barCode = currentItem?.bar_code;

  const { lots, floorStock, wipBatches } = useInventoryData(cutPlanId, barCode);

  const remaining = items.filter((i) => i.completed_pieces < i.total_pieces).length;
  const maxBars = currentItem ? (getMaxBars(currentItem.bar_code) || 10) : 10;

  // ── Foreman Brain context ──
  const foremanContext: ForemanContext | null = currentItem
    ? {
        module: "cut",
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
        selectedStockLength,
        currentIndex,
        canWrite,
      }
    : null;

  const foreman = useForemanBrain({ context: foremanContext });

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
        } catch {
          // Inventory consumption is best-effort
        }
      }

      // Record success learning
      const piecesPerBar = currentItem.pieces_per_bar || 1;
      const piecesProduced = bars * piecesPerBar;
      const remainingAfter = currentItem.total_pieces - currentItem.completed_pieces - piecesProduced;
      if (remainingAfter <= 0) {
        recordCompletion("cut", machine.id, currentItem.bar_code, {
          mark: currentItem.mark_number,
          total_pieces: currentItem.total_pieces,
          stock_length: stockLength,
        });
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

  const piecesPerBar = currentItem.pieces_per_bar || 1;
  const totalBars = currentItem.qty_bars || 0;
  const totalPieces = currentItem.total_pieces || 0;
  const completedPieces = currentItem.completed_pieces || 0;
  const remainingPieces = totalPieces - completedPieces;
  const barsStillNeeded = Math.ceil(remainingPieces / piecesPerBar);
  const isDone = remainingPieces <= 0;

  return (
    <div className="flex flex-col h-full">
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
        {/* Left panel — Operator Instructions */}
        <div className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto bg-muted/20">

          {/* Project / Plan context */}
          {(currentItem.project_name || currentItem.plan_name) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{currentItem.project_name || currentItem.plan_name}</span>
            </div>
          )}

          {/* ── FOREMAN BRAIN PANEL ── */}
          <ForemanPanel foreman={foreman} />

          {/* BIG CUT LENGTH */}
          <Card className="bg-card border border-border">
            <CardContent className="py-8 px-6 text-center">
              <p className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase font-medium mb-2">
                Cut Each Piece To
              </p>
              <p className="text-7xl sm:text-8xl lg:text-9xl font-black font-mono text-foreground leading-none tracking-tight">
                {currentItem.cut_length_mm}
              </p>
              <p className="text-sm text-primary tracking-[0.35em] uppercase mt-3 font-bold">
                MM
              </p>
            </CardContent>
          </Card>

          {/* OPERATOR STATS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Scissors className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">{piecesPerBar}</p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Pcs / Bar</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Layers className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">{totalBars}</p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Total Bars</p>
              </CardContent>
            </Card>
            <Card className={`border-border ${isDone ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
              <CardContent className="p-4 text-center">
                <Ruler className="w-5 h-5 text-accent-foreground mx-auto mb-2" />
                <p className={`text-3xl font-black font-mono ${isDone ? "text-primary" : "text-foreground"}`}>
                  {isDone ? "✓" : barsStillNeeded}
                </p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Bars Left</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Hash className="w-5 h-5 text-secondary-foreground mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">
                  {completedPieces}<span className="text-lg text-muted-foreground">/{totalPieces}</span>
                </p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Pieces Done</p>
              </CardContent>
            </Card>
          </div>

          {isDone && (
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6 flex items-center justify-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <p className="text-sm font-bold text-primary tracking-wider uppercase">
                  This mark is complete — move to next item
                </p>
              </CardContent>
            </Card>
          )}

          {/* ASA shape diagram if bend */}
          {currentItem.bend_type === "bend" && currentItem.asa_shape_code && (
            <Card className="bg-card border border-border">
              <CardContent className="py-6 px-4 flex justify-center">
                <AsaShapeDiagram
                  shapeCode={currentItem.asa_shape_code}
                  dimensions={currentItem.bend_dimensions}
                  size="md"
                />
              </CardContent>
            </Card>
          )}

          {/* Item navigation */}
          <div className="flex items-center justify-center gap-4 pt-2">
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
            suggestedBars={Math.min(barsStillNeeded, maxBars)}
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
