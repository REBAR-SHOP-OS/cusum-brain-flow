import { useState, useCallback } from "react";
import { StationHeader } from "./StationHeader";
import { CutEngine } from "./CutEngine";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { ForemanPanel } from "./ForemanPanel";
import { SlotTracker } from "./SlotTracker";
import { Card, CardContent } from "@/components/ui/card";
import { manageMachine } from "@/lib/manageMachineService";
import { manageInventory } from "@/lib/inventoryService";
import { recordCompletion, recordLearning } from "@/lib/foremanLearningService";
import { useToast } from "@/hooks/use-toast";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useForemanBrain } from "@/hooks/useForemanBrain";
import { useSlotTracker } from "@/hooks/useSlotTracker";
import { Scissors, Layers, Ruler, Hash, CheckCircle2 } from "lucide-react";
import type { ForemanContext } from "@/lib/foremanBrain";
import type { LiveMachine } from "@/types/machine";
import type { StationItem } from "@/hooks/useStationData";

interface CutterStationViewProps {
  machine: LiveMachine;
  items: StationItem[];
  canWrite: boolean;
}

const REMNANT_THRESHOLD_MM = 300;

export function CutterStationView({ machine, items, canWrite }: CutterStationViewProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStockLength, setSelectedStockLength] = useState(12000);
  const [operatorBars, setOperatorBars] = useState<number | null>(null);
  const [manualFloorConfirmed, setManualFloorConfirmed] = useState(false);

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
        operatorBars: operatorBars ?? undefined,
        currentIndex,
        canWrite,
        manualFloorStockConfirmed: manualFloorConfirmed,
      }
    : null;

  const foreman = useForemanBrain({ context: foremanContext });
  const runPlan = foreman.decision?.runPlan || null;

  // Determine if machine is actively running (local start or DB status)
  const machineIsRunning = isRunning || machine.status === "running";

  // ── Slot Tracker ──
  const slotTracker = useSlotTracker({
    runPlan,
    isRunning: machineIsRunning,
  });

  // Use run plan's computed values
  const computedPiecesPerBar = runPlan?.piecesPerBar || (currentItem ? Math.floor(selectedStockLength / currentItem.cut_length_mm) : 1);
  const totalPieces = currentItem?.total_pieces || 0;
  const completedPieces = currentItem?.completed_pieces || 0;
  const remainingPieces = totalPieces - completedPieces;
  const barsStillNeeded = computedPiecesPerBar > 0 ? Math.ceil(remainingPieces / computedPiecesPerBar) : 0;
  const barsForThisRun = operatorBars ?? runPlan?.barsThisRun ?? barsStillNeeded;
  const isDone = remainingPieces <= 0;

  // ── Alternative action handler ──
  const handleAlternativeAction = useCallback((actionType: string) => {
    if (actionType === "use_floor") {
      setManualFloorConfirmed(true);
      toast({ title: "Floor stock confirmed", description: "Run plan adjusted — LOCK & START enabled." });
    } else if (actionType === "use_remnant") {
      toast({ title: "Using remnant stock", description: "Foreman will select remnant as source." });
    } else if (actionType === "partial_run") {
      toast({ title: "Partial run selected", description: "Will complete as many pieces as stock allows." });
    }

    recordLearning({
      module: "cut",
      learningType: "edge_case",
      eventType: "smart_run_adjusted_due_to_stock_shortage",
      context: {
        machine_id: machine.id,
        bar_code: currentItem?.bar_code,
        cut_length: currentItem?.cut_length_mm,
        stock_length: selectedStockLength,
        action: actionType,
        bars_adjusted: runPlan?.barsThisRun,
        partial_slot: runPlan?.lastBarPieces,
      },
      machineId: machine.id,
      barCode: currentItem?.bar_code,
    });
  }, [machine.id, currentItem, selectedStockLength, runPlan, toast]);

  // ── LOCK & START ──
  const handleLockAndStart = async (stockLength: number, bars: number) => {
    if (!currentItem) return;
    try {
      setIsRunning(true);
      // Initialize slot tracker with actual bars the operator chose
      slotTracker.startWithBars(bars);

      const result = await manageMachine({
        action: "start-run",
        machineId: machine.id,
        process: "cut",
        barCode: currentItem.bar_code,
        qty: bars,
        notes: `Stock: ${stockLength}mm | Mark: ${currentItem.mark_number || "—"} | Length: ${currentItem.cut_length_mm}mm | Pcs/bar: ${computedPiecesPerBar}`,
      });

      const runId = result.machineRunId;

      // Try to consume from best available source
      const bestLot = lots.find((l) => l.qty_on_hand - l.qty_reserved >= bars);
      if (bestLot && runId) {
        try {
          await manageInventory({
            action: "consume-on-start",
            machineRunId: runId,
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

      // Record adjusted run learning
      if (runPlan?.isAdjusted) {
        recordLearning({
          module: "cut",
          learningType: "edge_case",
          eventType: "smart_run_adjusted_due_to_stock_shortage",
          context: {
            machine_id: machine.id,
            bar_code: currentItem.bar_code,
            cut_length_mm: currentItem.cut_length_mm,
            stock_length_mm: stockLength,
            bars_loaded: bars,
            pcs_per_bar: computedPiecesPerBar,
            partial_bar: runPlan.lastBarPieces,
            stock_source: runPlan.stockSource,
            adjustment_reason: runPlan.adjustmentReason,
          },
          machineId: machine.id,
          barCode: currentItem.bar_code,
        });
      }

      toast({ title: "Machine started", description: `Cutting ${currentItem.mark_number || "item"} — use slot tracker to record cuts` });
    } catch (err: any) {
      toast({ title: "Start failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  // ── Record stroke ──
  const handleRecordStroke = useCallback(() => {
    slotTracker.recordStroke();
    toast({
      title: "Cut recorded",
      description: `${slotTracker.totalCutsDone + 1} total cuts done`,
    });
  }, [slotTracker, toast]);

  // ── Remove bar ──
  const handleRemoveBar = useCallback(async (slotIndex: number) => {
    if (!currentItem) return;

    const slot = slotTracker.slots.find((s) => s.index === slotIndex);
    if (!slot) return;

    const leftover = selectedStockLength - slot.cutsDone * currentItem.cut_length_mm;

    slotTracker.removeBar(slotIndex);

    // Create remnant or scrap via inventory service
    if (leftover >= REMNANT_THRESHOLD_MM) {
      try {
        await manageInventory({
          action: "cut-complete",
          machineRunId: machine.current_run_id || undefined,
          cutPlanItemId: currentItem.id,
          barCode: currentItem.bar_code,
          qty: 1,
          stockLengthMm: selectedStockLength,
          cutLengthMm: currentItem.cut_length_mm,
          piecesPerBar: slot.cutsDone,
          bars: 1,
          reason: `Bar ${slotIndex + 1} removed — remnant ${leftover}mm`,
        });
      } catch {
        // Best-effort
      }
      toast({ title: `Bar ${slotIndex + 1} removed`, description: `Remnant: ${leftover}mm set aside` });
    } else {
      toast({ title: `Bar ${slotIndex + 1} removed`, description: `Scrap: ${leftover}mm (< ${REMNANT_THRESHOLD_MM}mm threshold)` });
    }

    recordLearning({
      module: "cut",
      learningType: "success",
      eventType: "bar_removed",
      context: {
        machine_id: machine.id,
        bar_code: currentItem.bar_code,
        slot_index: slotIndex,
        cuts_done: slot.cutsDone,
        planned_cuts: slot.plannedCuts,
        leftover_mm: leftover,
        is_remnant: leftover >= REMNANT_THRESHOLD_MM,
      },
      machineId: machine.id,
      barCode: currentItem.bar_code,
    });
  }, [currentItem, slotTracker, selectedStockLength, machine, toast]);

  // ── Complete run ──
  const handleCompleteRun = useCallback(async () => {
    if (!currentItem) return;

    try {
      const totalOutput = slotTracker.totalCutsDone;
      const scrapSlots = slotTracker.slots.filter(
        (s) => s.status === "removed" &&
          selectedStockLength - s.cutsDone * currentItem.cut_length_mm < REMNANT_THRESHOLD_MM
      ).length;

      await manageMachine({
        action: "complete-run",
        machineId: machine.id,
        outputQty: totalOutput,
        scrapQty: scrapSlots,
      });

      recordCompletion("cut", machine.id, currentItem.bar_code, {
        mark: currentItem.mark_number,
        total_pieces: currentItem.total_pieces,
        cuts_this_run: totalOutput,
        stock_length: selectedStockLength,
        scrap_count: scrapSlots,
        remnant_count: slotTracker.slots.filter(
          (s) => s.status === "removed" &&
            selectedStockLength - s.cutsDone * currentItem.cut_length_mm >= REMNANT_THRESHOLD_MM
        ).length,
        slots_completed: slotTracker.slots.filter((s) => s.status === "completed").length,
        slots_removed: slotTracker.slots.filter((s) => s.status === "removed").length,
      });

      slotTracker.reset();
      setIsRunning(false);
      setOperatorBars(null);
      setManualFloorConfirmed(false);

      // ── Routing toast based on bend type ──
      const markLabel = currentItem.mark_number || "item";
      const newCompletedPieces = completedPieces + totalOutput;
      const isMarkComplete = newCompletedPieces >= totalPieces;

      if (currentItem.bend_type === "bend") {
        toast({
          title: `✓ ${totalOutput} pieces cut — SEND TO BENDER`,
          description: `${markLabel} → Bending station${isMarkComplete ? " (mark complete)" : ""}`,
        });
      } else {
        toast({
          title: `✓ ${totalOutput} pieces cut — BUNDLE → PICKUP`,
          description: `${markLabel} → Bundle & send to pickup/delivery zone${isMarkComplete ? " (mark complete)" : ""}`,
        });
      }

      // ── Auto-advance to next item if mark is complete ──
      if (isMarkComplete && currentIndex < items.length - 1) {
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
        }, 1200);
      }
    } catch (err: any) {
      toast({ title: "Complete failed", description: err.message, variant: "destructive" });
    }
  }, [currentItem, slotTracker, selectedStockLength, machine, toast, completedPieces, totalPieces, currentIndex, items.length]);

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

          {/* ── SLOT TRACKER (visible during active run) ── */}
          {machineIsRunning && slotTracker.slots.length > 0 && (
            <SlotTracker
              slots={slotTracker.slots}
              barCode={currentItem.bar_code}
              cutLengthMm={currentItem.cut_length_mm}
              stockLengthMm={selectedStockLength}
              onRecordStroke={handleRecordStroke}
              onRemoveBar={handleRemoveBar}
              onCompleteRun={handleCompleteRun}
              canWrite={canWrite}
            />
          )}

          {/* ── FOREMAN BRAIN PANEL (instructions before/during run) ── */}
          {(!machineIsRunning || slotTracker.slots.length === 0) && (
            <ForemanPanel
              foreman={foreman}
              onAlternativeAction={handleAlternativeAction}
            />
          )}

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
                <p className="text-3xl font-black font-mono text-foreground">{computedPiecesPerBar}</p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Pcs / Bar</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Layers className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">{barsStillNeeded}</p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Bars Needed</p>
              </CardContent>
            </Card>
            <Card className={`border-border ${isDone ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
              <CardContent className="p-4 text-center">
                <Ruler className="w-5 h-5 text-accent-foreground mx-auto mb-2" />
                <p className={`text-3xl font-black font-mono ${isDone ? "text-primary" : "text-foreground"}`}>
                  {isDone ? "✓" : barsForThisRun}
                </p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">This Run</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Hash className="w-5 h-5 text-secondary-foreground mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">
                  {completedPieces + slotTracker.totalCutsDone}
                  <span className="text-lg text-muted-foreground">/{totalPieces}</span>
                </p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Pieces Done</p>
              </CardContent>
            </Card>
          </div>

          {isDone && !machineIsRunning && (
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
              disabled={currentIndex <= 0 || machineIsRunning}
              onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setManualFloorConfirmed(false); setOperatorBars(null); slotTracker.reset(); }}
            >
              ‹
            </button>
            <span className="text-sm text-muted-foreground font-mono min-w-[60px] text-center">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={currentIndex >= items.length - 1 || machineIsRunning}
              onClick={() => { setCurrentIndex((i) => Math.min(items.length - 1, i + 1)); setManualFloorConfirmed(false); setOperatorBars(null); slotTracker.reset(); }}
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
            runPlan={runPlan}
            onLockAndStart={handleLockAndStart}
            onStockLengthChange={setSelectedStockLength}
            onBarsChange={setOperatorBars}
            isRunning={machineIsRunning}
            canWrite={canWrite}
            darkMode
            strokesDone={slotTracker.slots.length > 0 ? slotTracker.slots[0].cutsDone : 0}
            totalStrokesNeeded={computedPiecesPerBar}
            totalPiecesDone={slotTracker.totalCutsDone}
            totalPiecesPlanned={slotTracker.slots.reduce((s, sl) => s + sl.plannedCuts, 0)}
            activeBars={slotTracker.slots.filter(s => s.status === "active").length}
          />
        </div>
      </div>
    </div>
  );
}
