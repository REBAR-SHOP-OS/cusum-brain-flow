/**
 * Foreman Brain — Deterministic decision engine for shop floor operator guidance.
 *
 * Input:  ForemanContext (module, task, machine, stock, inventory, progress)
 * Output: ForemanDecision (instructions, recommendation, alternatives, blockers, runPlan)
 *
 * Rules are deterministic. Capability / RLS / inventory invariants always override.
 */

import type { StationItem } from "@/hooks/useStationData";
import type { InventoryLot, FloorStockItem, CutOutputBatch } from "@/hooks/useInventoryData";

// ── Constants ──────────────────────────────────────────────────────────────

const REMNANT_THRESHOLD_MM = 300;

// ── Types ──────────────────────────────────────────────────────────────────

export type ForemanModule = "cut" | "bend" | "spiral" | "inventory" | "queue";

export type StockSourceType = "lot" | "remnant" | "floor" | "manual";

export interface ForemanContext {
  module: ForemanModule;
  machineId: string;
  machineName: string;
  machineModel: string;
  machineStatus: string;
  machineType: string;
  currentItem: StationItem | null;
  items: StationItem[];
  lots: InventoryLot[];
  floorStock: FloorStockItem[];
  wipBatches: CutOutputBatch[];
  maxBars: number | null;
  /** Operator-selected or default stock length in mm */
  selectedStockLength: number;
  /** Operator-selected bar count override (from CutEngine UI) */
  operatorBars?: number;
  /** Current index in item list */
  currentIndex: number;
  canWrite: boolean;
  /** Supervisor override for manual floor stock */
  manualFloorStockConfirmed?: boolean;
}

export interface ForemanInstruction {
  step: number;
  text: string;
  emphasis?: string; // bold value to highlight
}

export interface ForemanAlternative {
  id: string; // for action buttons
  label: string;
  description: string;
  reason: string;
  actionType?: "use_floor" | "use_remnant" | "adjust_plan" | "partial_run";
}

export interface ForemanBlocker {
  code: string;
  title: string;
  fixSteps: string[];
}

/** Slot-based run plan for a single cut run */
export interface RunSlot {
  index: number;
  plannedCuts: number;
  status: "active" | "partial" | "removed" | "completed";
  /** true if this bar should be removed after its cuts (partial bar) */
  removeAfterCuts: boolean;
}

export interface RunPlan {
  /** Computed pieces per bar for the selected stock length */
  piecesPerBar: number;
  /** Total bars needed to complete remaining pieces */
  totalBarsNeeded: number;
  /** Full bars (each producing piecesPerBar pieces) */
  fullBars: number;
  /** Pieces on the last partial bar (0 = no partial) */
  lastBarPieces: number;
  /** Remnant per full bar in mm */
  remnantPerFullBar: number;
  /** Remnant on the last (partial) bar in mm (0 if no partial) */
  lastBarRemnant: number;
  /** Expected scrap pieces (remnant < REMNANT_THRESHOLD) */
  expectedScrapBars: number;
  /** Expected remnant bars (remnant >= REMNANT_THRESHOLD) */
  expectedRemnantBars: number;
  /** Stock source that will be used */
  stockSource: StockSourceType;
  /** Is this an adjusted plan due to shortage? */
  isAdjusted: boolean;
  /** Adjustment reason if adjusted */
  adjustmentReason: string;
  /** Slot breakdown for the run */
  slots: RunSlot[];
  /** Is any feasible run possible? */
  feasible: boolean;
  /** Bars capped to machine capacity */
  barsThisRun: number;
}

export interface ForemanDecision {
  instructions: ForemanInstruction[];
  recommendation: string;
  recommendationReason: string;
  alternatives: ForemanAlternative[];
  blockers: ForemanBlocker[];
  warnings: string[];
  /** Edge case ID if one was detected */
  edgeCaseId: string | null;
  /** Computed run plan for CUT module */
  runPlan: RunPlan | null;
}

// ── Engine ─────────────────────────────────────────────────────────────────

export function computeForemanDecision(ctx: ForemanContext): ForemanDecision {
  const decision: ForemanDecision = {
    instructions: [],
    recommendation: "",
    recommendationReason: "",
    alternatives: [],
    blockers: [],
    warnings: [],
    edgeCaseId: null,
    runPlan: null,
  };

  if (!ctx.currentItem) {
    decision.recommendation = "No items queued — waiting for work.";
    decision.recommendationReason = "Queue is empty for this machine.";
    return decision;
  }

  switch (ctx.module) {
    case "cut":
      return computeCutDecision(ctx, decision);
    case "bend":
      return computeBendDecision(ctx, decision);
    case "spiral":
      return computeSpiralDecision(ctx, decision);
    default:
      return computeGenericDecision(ctx, decision);
  }
}

// ── RUN PLAN COMPUTATION ───────────────────────────────────────────────────

function computeRunPlan(
  stockLengthMm: number,
  cutLengthMm: number,
  remainingPieces: number,
  maxBars: number,
  availableLots: InventoryLot[],
  floorStock: FloorStockItem[],
  manualConfirmed: boolean
): RunPlan {
  const piecesPerBar = Math.floor(stockLengthMm / cutLengthMm);

  if (piecesPerBar <= 0) {
    return {
      piecesPerBar: 0, totalBarsNeeded: 0, fullBars: 0, lastBarPieces: 0,
      remnantPerFullBar: 0, lastBarRemnant: 0, expectedScrapBars: 0,
      expectedRemnantBars: 0, stockSource: "lot", isAdjusted: false,
      adjustmentReason: "", slots: [], feasible: false, barsThisRun: 0,
    };
  }

  const totalBarsNeeded = Math.ceil(remainingPieces / piecesPerBar);
  const fullBars = Math.floor(remainingPieces / piecesPerBar);
  const lastBarPieces = remainingPieces % piecesPerBar;

  const remnantPerFullBar = stockLengthMm - (piecesPerBar * cutLengthMm);
  const lastBarRemnant = lastBarPieces > 0 ? stockLengthMm - (lastBarPieces * cutLengthMm) : 0;

  // Count expected remnants vs scrap
  let expectedRemnantBars = 0;
  let expectedScrapBars = 0;

  if (remnantPerFullBar >= REMNANT_THRESHOLD_MM) {
    expectedRemnantBars += fullBars;
  } else if (remnantPerFullBar > 0) {
    expectedScrapBars += fullBars;
  }

  if (lastBarPieces > 0) {
    if (lastBarRemnant >= REMNANT_THRESHOLD_MM) {
      expectedRemnantBars += 1;
    } else if (lastBarRemnant > 0) {
      expectedScrapBars += 1;
    }
  }

  // ── Stock source resolution ──
  const lotAvailable = availableLots
    .filter(l => l.source !== "remnant")
    .reduce((s, l) => s + (l.qty_on_hand - l.qty_reserved), 0);

  const remnantAvailable = availableLots
    .filter(l => l.source === "remnant" && l.standard_length_mm >= cutLengthMm)
    .reduce((s, l) => s + (l.qty_on_hand - l.qty_reserved), 0);

  const floorAvailable = floorStock
    .filter(f => f.length_mm >= cutLengthMm)
    .reduce((s, f) => s + (f.qty_on_hand - f.qty_reserved), 0);

  const totalInventory = lotAvailable + remnantAvailable + floorAvailable;

  let stockSource: StockSourceType = "lot";
  let isAdjusted = false;
  let adjustmentReason = "";
  let barsThisRun = Math.min(totalBarsNeeded, maxBars);

  if (lotAvailable >= barsThisRun) {
    stockSource = "lot";
  } else if (floorAvailable > 0) {
    stockSource = "floor";
    isAdjusted = lotAvailable < barsThisRun;
    if (isAdjusted) {
      adjustmentReason = `Lot inventory insufficient (${lotAvailable}). Using floor stock (${floorAvailable} available).`;
    }
    barsThisRun = Math.min(barsThisRun, lotAvailable + floorAvailable);
  } else if (remnantAvailable > 0) {
    stockSource = "remnant";
    isAdjusted = true;
    adjustmentReason = `Using remnant stock (${remnantAvailable} usable pieces).`;
    barsThisRun = Math.min(barsThisRun, lotAvailable + remnantAvailable);
  } else if (manualConfirmed) {
    stockSource = "manual";
    isAdjusted = true;
    adjustmentReason = "Supervisor confirmed manual floor stock will be used.";
  } else if (totalInventory > 0) {
    // Partial run possible with whatever we have
    barsThisRun = Math.min(barsThisRun, totalInventory);
    isAdjusted = true;
    adjustmentReason = `Partial run: only ${totalInventory} bars available of ${totalBarsNeeded} needed.`;
    stockSource = lotAvailable > 0 ? "lot" : floorAvailable > 0 ? "floor" : "remnant";
  } else {
    // Zero inventory — still feasible if supervisor confirms
    barsThisRun = Math.min(totalBarsNeeded, maxBars);
    isAdjusted = true;
    adjustmentReason = "No tracked inventory. Supervisor can confirm manual floor stock.";
    stockSource = "manual";
  }

  // ── Build slots ──
  const slots: RunSlot[] = [];
  let piecesAssigned = 0;
  const piecesThisRun = Math.min(remainingPieces, barsThisRun * piecesPerBar);

  for (let i = 0; i < barsThisRun; i++) {
    const piecesLeft = piecesThisRun - piecesAssigned;
    if (piecesLeft <= 0) break;

    const cutsThisSlot = Math.min(piecesPerBar, piecesLeft);
    const isPartial = cutsThisSlot < piecesPerBar;

    slots.push({
      index: i,
      plannedCuts: cutsThisSlot,
      status: isPartial ? "partial" : "active",
      removeAfterCuts: isPartial,
    });

    piecesAssigned += cutsThisSlot;
  }

  return {
    piecesPerBar,
    totalBarsNeeded,
    fullBars,
    lastBarPieces,
    remnantPerFullBar,
    lastBarRemnant,
    expectedScrapBars,
    expectedRemnantBars,
    stockSource,
    isAdjusted,
    adjustmentReason,
    slots,
    feasible: barsThisRun > 0 && piecesPerBar > 0,
    barsThisRun,
  };
}

// ── CUT MODULE ─────────────────────────────────────────────────────────────

function computeCutDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  const item = ctx.currentItem!;
  const remaining = item.total_pieces - item.completed_pieces;
  const maxBars = ctx.maxBars || 10;

  // ─ Hard blockers (machine state + role) ─
  if (ctx.machineStatus === "down") {
    d.blockers.push({
      code: "MACHINE_DOWN",
      title: "Machine is DOWN",
      fixSteps: [
        "Contact maintenance to repair this machine.",
        "Reroute work to an alternate cutter if available.",
        "Do NOT attempt to start a run on a downed machine.",
      ],
    });
  }

  if (ctx.machineStatus === "blocked") {
    d.blockers.push({
      code: "MACHINE_BLOCKED",
      title: "Machine is BLOCKED",
      fixSteps: [
        "Check for jammed material or safety interlock.",
        "Clear the blockage before proceeding.",
        "If persistent, call supervisor.",
      ],
    });
  }

  if (!ctx.canWrite) {
    d.blockers.push({
      code: "READ_ONLY",
      title: "Office role — read-only access",
      fixSteps: ["Only Workshop or Admin roles can operate machines."],
    });
  }

  // ─ Compute run plan ─
  const availableLots = ctx.lots.filter(l => l.qty_on_hand - l.qty_reserved > 0);
  const floorAvailable = ctx.floorStock.filter(f => f.qty_on_hand - f.qty_reserved > 0 && f.length_mm >= item.cut_length_mm);

  const runPlan = computeRunPlan(
    ctx.selectedStockLength,
    item.cut_length_mm,
    remaining,
    maxBars,
    availableLots,
    floorAvailable as any,
    ctx.manualFloorStockConfirmed || false,
  );
  d.runPlan = runPlan;

  // ─ Stock length validation ─
  if (runPlan.piecesPerBar <= 0) {
    d.blockers.push({
      code: "STOCK_TOO_SHORT",
      title: `${ctx.selectedStockLength}mm stock cannot produce even 1 piece at ${item.cut_length_mm}mm`,
      fixSteps: [
        "Select a longer stock length.",
        `Minimum stock: ${item.cut_length_mm}mm.`,
      ],
    });
    return d;
  }

  // ─ Inventory analysis — SMART RECOVERY MODE ─
  const lotCount = availableLots.filter(l => l.source !== "remnant").reduce((s, l) => s + (l.qty_on_hand - l.qty_reserved), 0);
  const remnants = availableLots.filter(l => l.source === "remnant" && l.standard_length_mm >= item.cut_length_mm);
  const remnantCount = remnants.reduce((s, l) => s + (l.qty_on_hand - l.qty_reserved), 0);
  const floorCount = floorAvailable.reduce((s, f) => s + (f.qty_on_hand - f.qty_reserved), 0);
  const totalTracked = lotCount + remnantCount + floorCount;

  if (lotCount < runPlan.barsThisRun) {
    // Not enough lot stock — but we have alternatives?
    if (floorCount > 0) {
      d.alternatives.push({
        id: "use_floor",
        label: "Use Floor Stock",
        description: `${floorCount} bars on floor near machine`,
        reason: "Floor stock is staged and ready. Avoids waiting for warehouse pull.",
        actionType: "use_floor",
      });
    }

    if (remnantCount > 0) {
      const bestRemnant = remnants[0];
      d.alternatives.push({
        id: "use_remnant",
        label: "Use Remnants",
        description: `${remnantCount} usable remnants (${bestRemnant.standard_length_mm}mm+)`,
        reason: "Reduces waste by consuming existing offcuts before new stock.",
        actionType: "use_remnant",
      });
    }

    if (totalTracked > 0 && totalTracked < runPlan.totalBarsNeeded) {
      d.alternatives.push({
        id: "partial_run",
        label: "Partial Run",
        description: `Run ${Math.min(totalTracked, maxBars)} bars now (${Math.min(totalTracked, maxBars) * runPlan.piecesPerBar} pieces)`,
        reason: "Partial progress is better than waiting. Complete remaining when stock arrives.",
        actionType: "partial_run",
      });
    }

    if (totalTracked === 0 && !ctx.manualFloorStockConfirmed) {
      // No tracked inventory at all — downgrade to warning with manual override option
      d.alternatives.push({
        id: "manual_floor",
        label: "Confirm Manual Floor Stock",
        description: "Supervisor confirms physical bars are available at machine",
        reason: "Inventory may not reflect floor reality. Manual confirmation enables the run.",
        actionType: "use_floor",
      });

      d.warnings.push(
        `No tracked inventory for ${item.bar_code}. ${runPlan.totalBarsNeeded} bars needed. Supervisor can confirm floor stock to proceed.`
      );
      d.edgeCaseId = "shortage_mid_run";
    } else if (totalTracked < runPlan.barsThisRun) {
      d.warnings.push(
        `Stock shortage: ${totalTracked} tracked vs ${runPlan.barsThisRun} needed. Adjusted plan available.`
      );
      d.edgeCaseId = "shortage_mid_run";
    }

    // NEVER hard-block if supervisor confirmed or any alternative exists
    // Only hard block if truly nothing + no manual confirmation
  }

  // ─ Instructions ─
  if (remaining <= 0) {
    d.instructions = [
      { step: 1, text: "This mark is COMPLETE.", emphasis: "✓" },
      { step: 2, text: "Move to the next item in the queue." },
    ];
    d.recommendation = "Mark complete — advance to next item.";
    d.recommendationReason = `All ${item.total_pieces} pieces are done.`;
    return d;
  }

  // Deterministic shop-language instructions
  const { piecesPerBar, totalBarsNeeded, lastBarPieces, slots, barsThisRun } = runPlan;
  const operatorBars = ctx.operatorBars ?? barsThisRun;
  const hasPartialBar = lastBarPieces > 0 && operatorBars >= totalBarsNeeded;
  const fullSlots = slots.filter(s => !s.removeAfterCuts);
  const partialSlot = slots.find(s => s.removeAfterCuts);

  d.instructions = [
    {
      step: 1,
      text: "Set stopper to",
      emphasis: `${item.cut_length_mm} mm`,
    },
    {
      step: 2,
      text: `Load`,
      emphasis: `${operatorBars} × ${item.bar_code} bars (${ctx.selectedStockLength / 1000}M stock)`,
    },
    {
      step: 3,
      text: "Cut",
      emphasis: `${piecesPerBar} pieces per bar`,
    },
  ];

  if (hasPartialBar && partialSlot) {
    d.instructions.push({
      step: 4,
      text: `After ${partialSlot.plannedCuts} cut${partialSlot.plannedCuts > 1 ? "s" : ""}, REMOVE 1 bar and set aside`,
      emphasis: "(remnant)",
    });

    if (fullSlots.length > 0) {
      d.instructions.push({
        step: 5,
        text: `Continue with remaining`,
        emphasis: `${fullSlots.length} bar${fullSlots.length > 1 ? "s" : ""}`,
      });
    }
  }

  // Result summary — use operatorBars for display
  const totalPiecesThisRun = operatorBars * piecesPerBar - (hasPartialBar ? (piecesPerBar - lastBarPieces) : 0);
  const piecesAfter = remaining - totalPiecesThisRun;

  d.recommendation = `Load ${operatorBars} × ${item.bar_code} → cut at ${item.cut_length_mm}mm → ${totalPiecesThisRun} pieces`;
  d.recommendationReason = [
    `${piecesPerBar} pcs/bar × ${fullSlots.length} full bar${fullSlots.length !== 1 ? "s" : ""}`,
    hasPartialBar ? ` + ${lastBarPieces} pcs on partial bar` : "",
    ` = ${totalPiecesThisRun} pieces.`,
    piecesAfter > 0 ? ` ${piecesAfter} remaining after this run.` : " Completes this mark.",
    runPlan.expectedRemnantBars > 0 ? ` ${runPlan.expectedRemnantBars} remnant${runPlan.expectedRemnantBars > 1 ? "s" : ""} kept (≥${REMNANT_THRESHOLD_MM}mm).` : "",
    runPlan.expectedScrapBars > 0 ? ` ${runPlan.expectedScrapBars} scrap piece${runPlan.expectedScrapBars > 1 ? "s" : ""} (<${REMNANT_THRESHOLD_MM}mm).` : "",
    runPlan.isAdjusted ? ` [ADJUSTED: ${runPlan.adjustmentReason}]` : "",
  ].join("");

  return d;
}

// ── BEND MODULE ────────────────────────────────────────────────────────────

function computeBendDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  const item = ctx.currentItem!;
  const remaining = item.total_pieces - item.completed_pieces;

  if (!item.asa_shape_code) {
    d.blockers.push({
      code: "MISSING_SHAPE",
      title: "No ASA shape code assigned",
      fixSteps: [
        "Return this item to planning.",
        "Assign the correct shape code from the ASA library.",
        "Do NOT bend without a confirmed shape.",
      ],
    });
    d.edgeCaseId = "missing_shape_code";
  }

  if (ctx.machineStatus === "down" || ctx.machineStatus === "blocked") {
    d.blockers.push({
      code: `MACHINE_${ctx.machineStatus.toUpperCase()}`,
      title: `Machine is ${ctx.machineStatus.toUpperCase()}`,
      fixSteps: ["Clear the issue or reroute to alternate bender."],
    });
  }

  const wipAvailable = ctx.wipBatches.filter(w => w.bar_code === item.bar_code && w.qty_available > 0);
  const wipTotal = wipAvailable.reduce((s, w) => s + w.qty_available, 0);

  if (wipTotal === 0 && remaining > 0) {
    d.warnings.push(
      `No cut output (WIP) available for ${item.bar_code}. Ensure cutting is ahead of bending.`
    );
    d.edgeCaseId = d.edgeCaseId || "wip_missing";
  }

  if (ctx.maxBars !== null && ctx.maxBars === 0) {
    d.blockers.push({
      code: "CAPABILITY_VIOLATION",
      title: `${item.bar_code} exceeds this bender's capacity`,
      fixSteps: [
        "Check machine capability registry.",
        "Reroute to a bender rated for this bar size.",
      ],
    });
    d.edgeCaseId = d.edgeCaseId || "setup_mismatch";
  }

  if (remaining <= 0) {
    d.instructions = [
      { step: 1, text: "This mark is COMPLETE.", emphasis: "✓" },
      { step: 2, text: "Move to the next item." },
    ];
    d.recommendation = "Mark complete.";
    d.recommendationReason = `All ${item.total_pieces} pieces bent.`;
  } else {
    const dims = item.bend_dimensions;
    const dimStr = dims
      ? Object.entries(dims).map(([k, v]) => `${k}=${v}`).join(", ")
      : "see diagram";

    d.instructions = [
      { step: 1, text: `Shape code:`, emphasis: item.asa_shape_code || "NONE" },
      { step: 2, text: `Dimensions:`, emphasis: dimStr },
      { step: 3, text: `Feed`, emphasis: `${item.bar_code} pre-cut piece` },
      { step: 4, text: `Bend and verify against schematic` },
      { step: 5, text: `${remaining} piece${remaining > 1 ? "s" : ""} remaining` },
    ];
    d.recommendation = `Bend 1 × ${item.bar_code} — shape ${item.asa_shape_code || "?"} — ${remaining} left`;
    d.recommendationReason = wipTotal > 0
      ? `${wipTotal} pre-cut pieces available in WIP.`
      : "WIP is low — check cutter progress.";
  }

  return d;
}

// ── SPIRAL MODULE ──────────────────────────────────────────────────────────

function computeSpiralDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  const item = ctx.currentItem!;
  const remaining = item.total_pieces - item.completed_pieces;

  if (remaining <= 0) {
    d.instructions = [{ step: 1, text: "Mark complete.", emphasis: "✓" }];
    d.recommendation = "Done — advance.";
    d.recommendationReason = "All pieces produced.";
    return d;
  }

  d.instructions = [
    { step: 1, text: `Bar size:`, emphasis: item.bar_code },
    { step: 2, text: `Form circular shape per spec` },
    { step: 3, text: `${remaining} remaining` },
  ];
  d.recommendation = `Spiral 1 × ${item.bar_code}`;
  d.recommendationReason = `${remaining} pieces to go.`;
  return d;
}

// ── GENERIC ────────────────────────────────────────────────────────────────

function computeGenericDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  d.recommendation = "Follow standard operating procedure.";
  d.recommendationReason = "No specific rules for this module.";
  return d;
}
