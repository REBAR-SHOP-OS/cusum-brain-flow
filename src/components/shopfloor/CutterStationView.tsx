import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StationHeader } from "./StationHeader";
import { CutEngine } from "./CutEngine";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import { ForemanPanel } from "./ForemanPanel";
import { SlotTracker } from "./SlotTracker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { manageMachine } from "@/lib/manageMachineService";
import { manageInventory } from "@/lib/inventoryService";
import { recordCompletion, recordLearning } from "@/lib/foremanLearningService";
import { useToast } from "@/hooks/use-toast";
import { useMachineCapabilities } from "@/hooks/useCutPlans";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useForemanBrain } from "@/hooks/useForemanBrain";
import { useSlotTracker } from "@/hooks/useSlotTracker";
import { useUserRole } from "@/hooks/useUserRole";
import { Scissors, Layers, Ruler, Hash, CheckCircle2, AlertCircle, Edit3, Lock, Unlock, Trash2, Recycle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForemanContext } from "@/lib/foremanBrain";
import type { LiveMachine } from "@/types/machine";
import type { StationItem } from "@/hooks/useStationData";

interface CutterStationViewProps {
  machine: LiveMachine;
  items: StationItem[];
  canWrite: boolean;
  initialIndex?: number;
  userSelectedItem?: boolean;
  onBack?: () => void;
}

const REMNANT_THRESHOLD_MM = 300;

export function CutterStationView({ machine, items, canWrite, initialIndex = 0, userSelectedItem = false, onBack }: CutterStationViewProps) {
  // ── Project paused detection ──
  const currentItemForPause = items[0] || null;
  const isProjectPaused = items.some(i => i.project_status === 'paused');
  const effectiveCanWrite = canWrite && !isProjectPaused;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isShopSupervisor } = useUserRole();
  const canCorrectCount = isAdmin || isShopSupervisor;
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [trackedItemId, setTrackedItemId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStockLength, setSelectedStockLength] = useState(12000);
  const [operatorBars, setOperatorBars] = useState<number | null>(null);
  const [manualFloorConfirmed, setManualFloorConfirmed] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [completedAtRunStart, setCompletedAtRunStart] = useState<number | null>(null);
  const [justCompletedItemId, setJustCompletedItemId] = useState<string | null>(null);
  const [localCompletedOverride, setLocalCompletedOverride] = useState<Record<string, number>>({});
  const [completedLocally, setCompletedLocally] = useState(false);
  const [correctCountOpen, setCorrectCountOpen] = useState(false);
  const [correctCountValue, setCorrectCountValue] = useState("");
  const [restoredFromBackend, setRestoredFromBackend] = useState(false);
  const [remnantPromptOpen, setRemnantPromptOpen] = useState(false);
  const [remnantInfo, setRemnantInfo] = useState<{ lengthMm: number; isWasteBank: boolean } | null>(null);
  const remnantDecisionRef = useRef<"save" | "discard" | null>(null);

  // ── REFRESH-SAFE STATE RESTORATION ──
  // On mount, if machine has an active locked job, restore state from backend
  // Validates the actual run status before blindly restoring to avoid stale "ABORT" state
  // Also auto-clears if the active job is already completed (cut_done)
  useEffect(() => {
    if (restoredFromBackend) return;
    if (userSelectedItem) { setRestoredFromBackend(true); return; }
    if (items.length === 0) return;
    if (
      machine.cut_session_status === "running" &&
      machine.active_job_id &&
      machine.machine_lock
    ) {
      const lockedIndex = items.findIndex(i => i.id === machine.active_job_id);

      // ── Check if the active job is already completed (cut_done) ──
      const lockedItem = lockedIndex >= 0 ? items[lockedIndex] : null;
      const isJobDone = lockedItem && (lockedItem.phase === "cut_done" || lockedItem.completed_pieces >= lockedItem.total_pieces);

      if (isJobDone && machine.current_run_id) {
        // Active job is done — auto-clear stale lock
        console.warn("[CutterStation] Active job is cut_done, auto-clearing lock");
        manageMachine({
          action: "complete-run",
          machineId: machine.id,
          runId: machine.current_run_id,
          outputQty: 0,
          scrapQty: 0,
          notes: "Auto-cleared: active job already cut_done",
        }).catch(e => console.warn("[CutterStation] Auto-clear cut_done failed:", e));
        setCompletedLocally(true);
        queryClient.invalidateQueries({ queryKey: ["live-machines"] });
        setRestoredFromBackend(true);
        return;
      }

      if (lockedIndex >= 0 && machine.current_run_id) {
        supabase
          .from("machine_runs")
          .select("id, status, started_at, output_qty")
          .eq("id", machine.current_run_id)
          .single()
          .then(async ({ data: runRow, error: runErr }) => {
            if (runErr || !runRow || runRow.status !== "running") {
              console.warn("[CutterStation] Non-running run detected (status:", runRow?.status, "), auto-clearing");
              try {
                await manageMachine({
                  action: "complete-run",
                  machineId: machine.id,
                  runId: machine.current_run_id!,
                  outputQty: 0,
                  scrapQty: 0,
                  notes: "Auto-cleared stale run on restore",
                });
              } catch (e) {
                console.warn("[CutterStation] Auto-clear failed (may already be cleared):", e);
              }
              setCompletedLocally(true);
              queryClient.invalidateQueries({ queryKey: ["live-machines"] });
            } else {
              setCurrentIndex(lockedIndex);
              setTrackedItemId(machine.active_job_id!);
              setIsRunning(true);
              setActiveRunId(machine.current_run_id);
              setCompletedAtRunStart(0);
              supabase
                .from("cut_plan_items")
                .select("completed_pieces")
                .eq("id", machine.active_job_id!)
                .single()
                .then(({ data, error }) => {
                  if (error || !data) {
                    console.warn("[CutterStation] Failed to fetch completed_pieces for restore, falling back to 0");
                    setCompletedAtRunStart(0);
                  } else {
                    setCompletedAtRunStart(data.completed_pieces ?? 0);
                  }
                });
              console.log("[CutterStation] Restored active job from backend:", machine.active_job_id);
            }
          });
      } else if (lockedIndex < 0 && machine.current_run_id) {
        // ── Active job not in current items list (mismatch) — show banner, don't auto-clear ──
        console.warn("[CutterStation] Active job", machine.active_job_id, "not found in items list (mismatch)");
        // We'll handle this in the render via machineHasMismatchedRun
      }
    }
    setRestoredFromBackend(true);
  }, [machine.cut_session_status, machine.active_job_id, machine.machine_lock, restoredFromBackend, items.length]);

  // ID-based reconciliation: after items refresh, find the tracked item and fix index
  useEffect(() => {
    if (!trackedItemId || items.length === 0) return;
    const newIdx = items.findIndex(i => i.id === trackedItemId);
    if (newIdx >= 0 && newIdx !== currentIndex) {
      setCurrentIndex(newIdx);
    } else if (newIdx < 0) {
      // Item removed from list — clamp index
      if (currentIndex >= items.length) {
        setCurrentIndex(Math.max(0, items.length - 1));
      }
    }
  }, [items, trackedItemId]);

  // Clear justCompleted guard when the item leaves the list or we switch items
  useEffect(() => {
    if (!justCompletedItemId) return;
    const stillInList = items.some(i => i.id === justCompletedItemId);
    if (!stillInList) {
      setJustCompletedItemId(null);
      setLocalCompletedOverride(prev => {
        const next = { ...prev };
        delete next[justCompletedItemId];
        return next;
      });
    }
  }, [items, justCompletedItemId]);

  // Bug fix #2b: Clear localCompletedOverride when DB value catches up via realtime
  useEffect(() => {
    setLocalCompletedOverride(prev => {
      const next = { ...prev };
      let changed = false;
      for (const item of items) {
        if (next[item.id] != null && item.completed_pieces >= next[item.id]) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  // Reset run state when switching to a different item (Bug #12)
  const currentItem = items[currentIndex] || null;

  // Initialize trackedItemId on first valid item
  useEffect(() => {
    if (currentItem && !trackedItemId) {
      setTrackedItemId(currentItem.id);
    }
  }, [currentItem, trackedItemId]);

  const [prevItemId, setPrevItemId] = useState<string | null>(null);
  useEffect(() => {
    if (currentItem && prevItemId !== currentItem.id) {
      // Only reset if we actually changed items (not first render or restore)
      if (prevItemId !== null && restoredFromBackend) {
        setCompletedAtRunStart(null);
        setOperatorBars(null);
      }
      setPrevItemId(currentItem.id);
    }
  }, [currentItem?.id, restoredFromBackend]); // eslint-disable-line react-hooks/exhaustive-deps
  const { getMaxBars } = useMachineCapabilities(machine.model, "cut");
  const cutPlanId = currentItem?.cut_plan_id || null;
  const barCode = currentItem?.bar_code;

  const { lots, floorStock, wipBatches } = useInventoryData(cutPlanId, barCode);

  // Bug fix #4: Account for localCompletedOverride so remaining count updates immediately
  const remaining = items.filter((i) => {
    const effective = localCompletedOverride[i.id] != null ? localCompletedOverride[i.id] : i.completed_pieces;
    return effective < i.total_pieces;
  }).length;
  // max_bars = machine throat capacity from spec sheet (NOT pieces per bar)
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
  // Only treat DB "running" as active if the locked job matches the current item
  const machineHasActiveRun = !completedLocally && machine.status === "running" && machine.current_run_id != null;
  const runMatchesCurrentItem = machineHasActiveRun && (!machine.active_job_id || machine.active_job_id === currentItem?.id);
  const machineHasMismatchedRun = machineHasActiveRun && machine.active_job_id != null && machine.active_job_id !== currentItem?.id;
  const machineIsRunning = isRunning || runMatchesCurrentItem;

  // Clear completedLocally flag once DB catches up
  useEffect(() => {
    if (machine.status !== "running") {
      setCompletedLocally(false);
    }
  }, [machine.status]);

  // ── Slot Tracker ──
  const slotTracker = useSlotTracker({
    runPlan,
    isRunning: machineIsRunning,
  });

  // Use run plan's computed values
  const computedPiecesPerBar = runPlan?.piecesPerBar || (currentItem ? Math.floor(selectedStockLength / currentItem.cut_length_mm) : 1);
  const totalPieces = currentItem?.total_pieces || 0;
  const completedPieces = currentItem?.completed_pieces || 0;

  // SINGLE SOURCE OF TRUTH: during a run, use snapshot + local tracker;
  // when idle, use whatever the DB/realtime says.
  // localCompletedOverride takes priority when set (prevents stale-data loop after completing a run)
  const effectiveCompleted = currentItem && localCompletedOverride[currentItem.id] != null
    ? localCompletedOverride[currentItem.id]
    : completedAtRunStart != null
      ? completedAtRunStart + slotTracker.totalCutsDone
      : completedPieces; // DB value already includes increments — never double-add local cuts

  const remainingPieces = totalPieces - effectiveCompleted;
  const barsStillNeeded = computedPiecesPerBar > 0 ? Math.ceil(remainingPieces / computedPiecesPerBar) : 0;
  const autoBarsToLoad = Math.max(1, Math.min(barsStillNeeded, maxBars));
  const barsForThisRun = operatorBars != null ? Math.max(1, Math.min(operatorBars, maxBars)) : (runPlan?.barsThisRun ?? autoBarsToLoad);
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
  const startingRef = useRef(false);
  const handleLockAndStart = async (stockLength: number, bars: number) => {
    if (!currentItem || startingRef.current) return;
    startingRef.current = true;
    // Server-side manage-machine handles stale/orphan/inactive run recovery automatically.
    // No client-side gate needed — let the server decide.

    // Force-clear stale run before starting if we just aborted
    if (completedLocally && machine.current_run_id) {
      try {
        await manageMachine({
          action: "complete-run",
          machineId: machine.id,
          runId: machine.current_run_id,
          outputQty: 0,
          scrapQty: 0,
          notes: "Pre-start cleanup after abort",
        });
        console.log("[CutterStation] Pre-start cleanup completed for stale run:", machine.current_run_id);
        // Wait for DB to propagate the cleared state before starting new run
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        console.warn("[CutterStation] Pre-start cleanup failed (may already be cleared):", e);
      }
    }

    // Hard clamp: never exceed machine max capacity regardless of role
    const finalBars = Math.max(1, Math.min(bars, maxBars));
    try {
      setIsRunning(true);
      setCompletedAtRunStart(completedPieces); // Sync fallback — async fetch refines below
      // Fetch fresh completed_pieces from DB to avoid stale realtime data
      const { data: freshRow } = await supabase
        .from("cut_plan_items")
        .select("completed_pieces")
        .eq("id", currentItem.id)
        .single();
      const freshCompleted = freshRow?.completed_pieces ?? completedPieces;
      setCompletedAtRunStart(freshCompleted);
      // Initialize slot tracker with actual bars the operator chose
      slotTracker.startWithBars(finalBars);

      const result = await manageMachine({
        action: "start-run",
        machineId: machine.id,
        process: "cut",
        barCode: currentItem.bar_code,
        qty: finalBars,
        notes: `Stock: ${stockLength}mm | Mark: ${currentItem.mark_number || "—"} | Length: ${currentItem.cut_length_mm}mm | Pcs/bar: ${computedPiecesPerBar}`,
        cutPlanItemId: currentItem.id,
        cutPlanId: currentItem.cut_plan_id || undefined,
        assignedBy: "manual",
      }, { timeoutMs: 30000, retries: 1 });

      const runId = result.machineRunId;
      setActiveRunId(runId || null);

      // Try to consume from best available source — re-fetch lots to avoid stale cache
      if (runId) {
        try {
          const { data: freshLots } = await supabase
            .from("inventory_lots")
            .select("id, bar_code, source, standard_length_mm, qty_on_hand, qty_reserved")
            .eq("bar_code", currentItem.bar_code)
            .gt("qty_on_hand", 0);
          const bestLot = (freshLots || []).find((l) => l.qty_on_hand - l.qty_reserved >= finalBars);
          if (bestLot) {
            await manageInventory({
              action: "consume-on-start",
              machineRunId: runId,
              cutPlanItemId: currentItem.id,
              barCode: currentItem.bar_code,
              qty: finalBars,
              sourceType: bestLot.source === "remnant" ? "remnant" : "lot",
              sourceId: bestLot.id,
              stockLengthMm: stockLength,
            });
          }
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
            bars_loaded: finalBars,
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
      setIsRunning(false);
      setCompletedAtRunStart(null);
      toast({ title: "Start failed", description: err.message, variant: "destructive" });
    } finally {
      startingRef.current = false;
    }
    // NOTE: Do NOT reset isRunning in finally — it stays true until
    // handleCompleteRun or reset. This prevents a race condition where
    // machineIsRunning briefly becomes false before the DB status refreshes.
  };

  // ── ABORT RUN (before any strokes) ──
  const handleAbortRun = useCallback(async () => {
    if (slotTracker.totalCutsDone > 0) return; // Safety: only abort if no strokes recorded
    try {
      if (activeRunId) {
        await manageMachine({
          action: "complete-run",
          machineId: machine.id,
          outputQty: 0,
          scrapQty: 0,
          notes: "Aborted before first stroke",
        });
      }
      slotTracker.reset();
      setIsRunning(false);
      setCompletedLocally(true);
      setActiveRunId(null);
      setCompletedAtRunStart(null);
      setOperatorBars(null);
      toast({ title: "Run aborted", description: "You can adjust settings and restart." });
    } catch (err: any) {
      toast({ title: "Abort failed", description: err.message, variant: "destructive" });
    }
  }, [activeRunId, machine.id, slotTracker, toast]);

  // ── Record stroke ──
  const handleRecordStroke = useCallback(() => {
    // Graceful fallback: use current completedPieces if snapshot not yet set
    const effectiveRunStart = completedAtRunStart ?? completedPieces;

    // Count active bars BEFORE the stroke (this is how many pieces this stroke produces)
    const activeBars = slotTracker.slots.filter(s => s.status === "active").length;
    const newCutsDone = slotTracker.totalCutsDone + activeBars;

    slotTracker.recordStroke();

    // ── Persist progress to DB after every stroke (atomic increment + 1 retry) ──
    if (currentItem) {
      console.log("[CutterStation] RPC call:", { itemId: currentItem.id, activeBars, completedAtRunStart });
      const doIncrement = () =>
        supabase.rpc("increment_completed_pieces", {
          p_item_id: currentItem.id,
          p_increment: activeBars,
        });

      doIncrement().then(({ error }) => {
        if (error) {
          console.warn("[CutterStation] Stroke persist failed, retrying in 1s:", error.message);
          setTimeout(() => {
            doIncrement().then(({ error: retryErr }) => {
              if (retryErr) {
                console.error("[CutterStation] Stroke persist retry failed:", retryErr.message);
                toast({ title: "⚠️ Stroke save failed", description: retryErr.message, variant: "destructive" });
              }
            });
          }, 1000);
        }
      });
    } else {
      console.warn("[CutterStation] No currentItem — stroke NOT persisted!");
    }

    // NOTE: Remnant prompt is deferred to handleCompleteRun to avoid blocking mid-run UI

    toast({
      title: "Cut recorded",
      description: `${newCutsDone} total cuts done`,
    });
  }, [slotTracker, toast, currentItem, completedAtRunStart]);

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
          machineRunId: activeRunId || machine.current_run_id || undefined,
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
  }, [currentItem, slotTracker, selectedStockLength, machine, toast, activeRunId]);

  // ── Complete run ──
  const handleCompleteRun = useCallback(async () => {
    if (!currentItem) return;

    try {
      const totalOutput = slotTracker.totalCutsDone;
      const scrapSlots = slotTracker.slots.filter(
        (s) => s.status === "removed" &&
          selectedStockLength - s.cutsDone * currentItem.cut_length_mm < REMNANT_THRESHOLD_MM
      ).length;

      // NOTE: completed_pieces already persisted stroke-by-stroke (see recordStroke handler).
      // No final increment needed here — doing so would double-count.

      // Immediately invalidate to refresh UI without waiting for realtime
      queryClient.invalidateQueries({ queryKey: ["station-data", machine.id] });

      // Compute remnant info for waste bank
      const completedSlots = slotTracker.slots.filter(s => s.status === "completed");
      const avgRemnant = completedSlots.length > 0
        ? Math.round(completedSlots.reduce((sum, s) => sum + (selectedStockLength - s.cutsDone * currentItem.cut_length_mm), 0) / completedSlots.length)
        : 0;

      // ── Show remnant prompt BEFORE completing run (deferred from handleRecordStroke) ──
      if (avgRemnant > 0 && !remnantDecisionRef.current) {
        setRemnantInfo({
          lengthMm: avgRemnant,
          isWasteBank: avgRemnant >= REMNANT_THRESHOLD_MM,
        });
        setRemnantPromptOpen(true);
        // Don't proceed with completion yet — user must acknowledge remnant prompt first
        return;
      }

      await manageMachine({
        action: "complete-run",
        machineId: machine.id,
        outputQty: totalOutput,
        scrapQty: scrapSlots,
        cutPlanItemId: currentItem.id,
        cutPlanId: currentItem.cut_plan_id || undefined,
        plannedQty: barsForThisRun * computedPiecesPerBar,
        remnantLengthMm: remnantDecisionRef.current === "save" && avgRemnant >= REMNANT_THRESHOLD_MM ? avgRemnant : undefined,
        remnantBarCode: remnantDecisionRef.current === "save" && avgRemnant >= REMNANT_THRESHOLD_MM ? currentItem.bar_code : undefined,
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

      const markLabel = currentItem.mark_number || "item";
      const newCompletedPieces = (completedAtRunStart ?? completedPieces) + totalOutput;
      const isMarkComplete = newCompletedPieces >= totalPieces;

      // ── Set completion guard BEFORE resetting run state ──
      if (isMarkComplete) {
        setJustCompletedItemId(currentItem.id);
      }
      setLocalCompletedOverride(prev => ({ ...prev, [currentItem.id]: newCompletedPieces }));

      slotTracker.reset();
      setCompletedLocally(true);
      setIsRunning(false);
      setActiveRunId(null);
      setOperatorBars(null);
      setManualFloorConfirmed(false);
      setCompletedAtRunStart(null);
      setRemnantPromptOpen(false);
      setRemnantInfo(null);
      remnantDecisionRef.current = null;

      // ── Routing toast based on bend type ──
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

      // ── Return to pool after completion ──
      setTimeout(() => {
        onBack?.();
      }, 1500);
    } catch (err: any) {
      toast({ title: "Complete failed", description: err.message, variant: "destructive" });
    }
  }, [currentItem, slotTracker, selectedStockLength, machine, toast, completedPieces, totalPieces, currentIndex, items, completedAtRunStart, barsForThisRun, computedPiecesPerBar, queryClient, remnantPromptOpen]);

  if (!currentItem) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader
          machineName={machine.name}
          machineModel={machine.model}
          canWrite={canWrite}
          isSupervisor={isSupervisor}
          onToggleSupervisor={canCorrectCount ? () => setIsSupervisor(v => !v) : undefined}
          onBack={onBack}
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
        isSupervisor={isSupervisor}
        onToggleSupervisor={canCorrectCount ? () => setIsSupervisor(v => !v) : undefined}
        onBack={onBack}
        showBedsSuffix={false}
      />

      {/* ── MISMATCHED RUN BANNER (machine locked to different item) ── */}
      {machineHasMismatchedRun && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-destructive/15">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">
              MACHINE LOCKED TO ANOTHER ITEM
            </p>
            <p className="text-xs text-destructive/80">
              Active job: <span className="font-mono font-bold">{machine.active_job_id?.slice(0, 8)}</span> — Complete or clear that run before starting a new one.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={async () => {
              try {
                await manageMachine({
                  action: "complete-run",
                  machineId: machine.id,
                  outputQty: 0,
                  scrapQty: 0,
                  notes: "Cleared stale lock — mismatched active job",
                });
                setCompletedLocally(true);
                queryClient.invalidateQueries({ queryKey: ["live-machines"] });
                toast({ title: "Lock cleared", description: "Machine is now idle. You can start a new run." });
              } catch (err: any) {
                toast({ title: "Clear failed", description: err.message, variant: "destructive" });
              }
            }}
          >
            Clear Lock
          </Button>
        </div>
      )}

      {/* ── MACHINE LOCK STATUS BAR ── */}
      {machine.machine_lock && !machineHasMismatchedRun && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-destructive/10">
          <Lock className="w-4 h-4 text-destructive" />
          <span className="text-xs font-bold text-destructive uppercase tracking-wider">
            LOCKED — {machine.job_assigned_by === "optimizer" ? "Optimizer" : machine.job_assigned_by === "supervisor" ? "Supervisor" : "Manual"} Assignment
          </span>
          {currentItem && (
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              Active: {currentItem.mark_number || currentItem.id.slice(0, 8)}
            </span>
          )}
        </div>
      )}
      {!machine.machine_lock && machine.cut_session_status === "idle" && (
        <div className="flex items-center gap-2 px-6 py-1.5 border-b border-border bg-muted/20">
          <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unlocked — Ready</span>
        </div>
      )}

      {/* Remaining progress strip */}
      <div className={cn(
        "flex items-center justify-between px-6 py-2 border-b border-border",
        remaining <= 3 ? "bg-green-500/10" : remaining <= 10 ? "bg-amber-500/10" : "bg-muted/30"
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-2xl font-black font-mono",
            remaining <= 3 ? "text-green-500" : remaining <= 10 ? "text-amber-500" : "text-foreground"
          )}>
            {remaining}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            marks remaining of {items.length}
          </span>
        </div>
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              remaining <= 3 ? "bg-green-500" : remaining <= 10 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${((items.length - remaining) / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Operator Instructions */}
        <div className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto bg-muted/20">

          {/* ── PROJECT PAUSED BANNER ── */}
          {isProjectPaused && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-bold text-destructive tracking-wider uppercase">
                  PROJECT PAUSED
                </p>
                <p className="text-xs text-destructive/80">
                  Recording disabled. Contact supervisor.
                </p>
              </div>
            </div>
          )}
          {/* Project / Plan context */}
          {(currentItem.project_name || currentItem.plan_name) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{currentItem.project_name || currentItem.plan_name}</span>
            </div>
          )}

          {/* ── JUST-COMPLETED GUARD: suppress run UI while waiting for realtime ── */}
          {justCompletedItemId === currentItem.id ? (
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-primary" />
                {remaining <= 1 ? (
                  <>
                    <p className="text-sm font-bold text-primary tracking-wider uppercase">
                      All marks complete — this machine is done
                    </p>
                    {onBack && (
                      <button
                        onClick={onBack}
                        className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-bold hover:bg-primary/90 transition-colors"
                      >
                        ← Back to Station Dashboard
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-bold text-primary tracking-wider uppercase">
                    Mark complete — advancing to next item…
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
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
                  canWrite={effectiveCanWrite}
                />
              )}

              {/* ── FOREMAN BRAIN PANEL (instructions before/during run) ── */}
              {(!machineIsRunning || slotTracker.slots.length === 0) && (
                <ForemanPanel
                  foreman={foreman}
                  onAlternativeAction={handleAlternativeAction}
                />
              )}
            </>
          )}

          {/* BIG CUT LENGTH */}
          <Card className="bg-card border border-border">
            <CardContent className="py-8 px-6">
              <p className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase font-medium mb-2 text-center">
                Cut Each Piece To
              </p>
              <div className="flex items-center justify-center gap-4">
                <Scissors className="w-10 h-10 text-primary shrink-0" />
                <p className="text-7xl sm:text-8xl lg:text-9xl font-black font-mono text-foreground leading-none tracking-tight">
                  {currentItem.cut_length_mm}
                </p>
                <Ruler className="w-10 h-10 text-primary shrink-0" />
              </div>
              <p className="text-sm text-primary tracking-[0.35em] uppercase mt-3 font-bold text-center">
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
              <CardContent className="p-4 text-center relative">
                <Hash className="w-5 h-5 text-secondary-foreground mx-auto mb-2" />
                <p className="text-3xl font-black font-mono text-foreground">
                  {effectiveCompleted}
                  <span className="text-lg text-muted-foreground">/{totalPieces}</span>
                </p>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Pieces Done</p>
                {canCorrectCount && !machineIsRunning && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCorrectCountValue(String(effectiveCompleted));
                      setCorrectCountOpen(true);
                    }}
                    title="Correct piece count"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {isDone && !machineIsRunning && justCompletedItemId !== currentItem.id && (
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <p className="text-sm font-bold text-primary tracking-wider uppercase">
                  {remaining <= 1
                    ? "All marks complete — this machine is done"
                    : "This mark is complete — move to next item"}
                </p>
                {remaining <= 1 && onBack && (
                  <button
                    onClick={onBack}
                    className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    ← Back to Station Dashboard
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ASA shape diagram if bend — only shown once cutting has started */}
          {currentItem.bend_type === "bend" && currentItem.asa_shape_code &&
            (currentItem.completed_pieces > 0 || currentItem.phase === "bending" || currentItem.phase === "cut_done") && (
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
              onClick={() => { const ni = Math.max(0, currentIndex - 1); setCurrentIndex(ni); if (items[ni]) setTrackedItemId(items[ni].id); setManualFloorConfirmed(false); setOperatorBars(null); slotTracker.reset(); }}
            >
              ‹
            </button>
            <span className="text-sm text-muted-foreground font-mono min-w-[60px] text-center">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={currentIndex >= items.length - 1 || machineIsRunning}
              onClick={() => { const ni = Math.min(items.length - 1, currentIndex + 1); setCurrentIndex(ni); if (items[ni]) setTrackedItemId(items[ni].id); setManualFloorConfirmed(false); setOperatorBars(null); slotTracker.reset(); }}
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
            suggestedBars={autoBarsToLoad}
            runPlan={runPlan}
            onLockAndStart={handleLockAndStart}
            onStockLengthChange={setSelectedStockLength}
            onBarsChange={setOperatorBars}
            onAbort={handleAbortRun}
            onStopRun={handleCompleteRun}
            isRunning={machineIsRunning}
            canWrite={effectiveCanWrite}
            isDone={isDone}
            isSupervisor={isSupervisor}
            darkMode
            lockedBars={machineIsRunning ? slotTracker.slots.length : undefined}
            strokesDone={slotTracker.slots.length > 0 ? Math.max(...slotTracker.slots.map(s => s.cutsDone)) : 0}
            totalStrokesNeeded={computedPiecesPerBar}
            totalPiecesDone={slotTracker.totalCutsDone}
            totalPiecesPlanned={slotTracker.slots.reduce((s, sl) => s + sl.plannedCuts, 0)}
            activeBars={slotTracker.slots.filter(s => s.status === "active").length}
          />
        </div>
      </div>
      {/* ── Remnant / Waste Prompt Dialog ── */}
      <Dialog open={remnantPromptOpen} onOpenChange={() => { /* block dismiss — must use buttons */ }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {remnantInfo?.isWasteBank ? (
                <><Recycle className="w-5 h-5 text-primary" /> Remove Remnant</>
              ) : (
                <><Trash2 className="w-5 h-5 text-destructive" /> Remove Waste</>
              )}
            </DialogTitle>
            <DialogDescription>
              {remnantInfo?.isWasteBank
                ? "The remaining stock qualifies for the waste bank."
                : "The remaining stock is too short to reuse."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining Length</p>
              <p className="text-4xl font-black font-mono text-foreground">{remnantInfo?.lengthMm ?? 0}<span className="text-lg text-muted-foreground ml-1">mm</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {remnantInfo?.isWasteBank
                  ? `≥ ${REMNANT_THRESHOLD_MM}mm — eligible for waste bank`
                  : `< ${REMNANT_THRESHOLD_MM}mm — discard as scrap`}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {remnantInfo?.isWasteBank && (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  remnantDecisionRef.current = "save";
                  setRemnantPromptOpen(false);
                  setRemnantInfo(null);
                  handleCompleteRun();
                }}
              >
                <Recycle className="w-4 h-4" />
                Save Remnant to Waste Bank
              </Button>
            )}
            <Button
              variant={remnantInfo?.isWasteBank ? "outline" : "default"}
              className="w-full gap-2"
              onClick={() => {
                remnantDecisionRef.current = "discard";
                setRemnantPromptOpen(false);
                setRemnantInfo(null);
                handleCompleteRun();
              }}
            >
              <Trash2 className="w-4 h-4" />
              {remnantInfo?.isWasteBank ? "Discard as Scrap" : "Remove Waste — Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Correct Count Dialog (supervisor only) ── */}
      <Dialog open={correctCountOpen} onOpenChange={setCorrectCountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Correct Piece Count</DialogTitle>
            <DialogDescription>
              Override the completed pieces count for mark <strong>{currentItem?.mark_number}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-muted-foreground mb-1 block">Actual completed pieces</label>
            <Input
              type="number"
              min={0}
              max={totalPieces}
              value={correctCountValue}
              onChange={(e) => setCorrectCountValue(e.target.value)}
              className="font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">Total required: {totalPieces}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectCountOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const newVal = Math.max(0, Math.min(totalPieces, parseInt(correctCountValue) || 0));
                if (!currentItem) return;
                try {
                  const { error } = await supabase
                    .from("cut_plan_items")
                    .update({ completed_pieces: newVal })
                    .eq("id", currentItem.id);
                  if (error) throw error;
                  setLocalCompletedOverride(prev => ({ ...prev, [currentItem.id]: newVal }));
                  queryClient.invalidateQueries({ queryKey: ["station-data", machine.id] });
                  toast({ title: "Count corrected", description: `Pieces done set to ${newVal}` });
                  setCorrectCountOpen(false);
                } catch (err: any) {
                  toast({ title: "Failed to update", description: err.message, variant: "destructive" });
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
