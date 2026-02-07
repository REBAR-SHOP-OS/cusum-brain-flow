/**
 * Foreman Brain — Deterministic decision engine for shop floor operator guidance.
 *
 * Input:  ForemanContext (module, task, machine, stock, inventory, progress)
 * Output: ForemanDecision (instructions, recommendation, alternatives, blockers)
 *
 * Rules are deterministic. Capability / RLS / inventory invariants always override.
 */

import type { StationItem } from "@/hooks/useStationData";
import type { InventoryLot, FloorStockItem, CutOutputBatch } from "@/hooks/useInventoryData";

// ── Types ──────────────────────────────────────────────────────────────────

export type ForemanModule = "cut" | "bend" | "spiral" | "inventory" | "queue";

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
  /** Current index in item list */
  currentIndex: number;
  canWrite: boolean;
}

export interface ForemanInstruction {
  step: number;
  text: string;
  emphasis?: string; // bold value to highlight
}

export interface ForemanAlternative {
  label: string;
  description: string;
  reason: string;
}

export interface ForemanBlocker {
  code: string;
  title: string;
  fixSteps: string[];
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
  };

  if (!ctx.currentItem) {
    decision.recommendation = "No items queued — waiting for work.";
    decision.recommendationReason = "Queue is empty for this machine.";
    return decision;
  }

  // Dispatch to module-specific engine
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

// ── CUT MODULE ─────────────────────────────────────────────────────────────

function computeCutDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  const item = ctx.currentItem!;
  const piecesPerBar = item.pieces_per_bar || 1;
  const remaining = item.total_pieces - item.completed_pieces;
  const barsNeeded = Math.ceil(remaining / piecesPerBar);
  const maxBars = ctx.maxBars || 10;
  const barsThisRun = Math.min(barsNeeded, maxBars);

  // ─ Blockers ─
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

  // ─ Inventory analysis ─
  const availableLots = ctx.lots.filter(l => l.qty_on_hand - l.qty_reserved > 0);
  const totalAvailable = availableLots.reduce((s, l) => s + (l.qty_on_hand - l.qty_reserved), 0);
  const remnants = availableLots.filter(l => l.source === "remnant");
  const floorAvailable = ctx.floorStock.filter(f => f.qty_on_hand - f.qty_reserved > 0);

  if (totalAvailable < barsThisRun && floorAvailable.length === 0) {
    d.blockers.push({
      code: "SHORTAGE",
      title: `Only ${totalAvailable} bars available — need ${barsThisRun}`,
      fixSteps: [
        `Check floor stock near the machine.`,
        `Check remnant bins for usable offcuts.`,
        `Reduce bars-to-load or contact purchasing.`,
      ],
    });
    d.edgeCaseId = "shortage_mid_run";
  }

  // ─ Remnant substitution opportunity ─
  if (remnants.length > 0) {
    const bestRemnant = remnants.find(r => r.standard_length_mm >= item.cut_length_mm);
    if (bestRemnant) {
      d.alternatives.push({
        label: "Use remnant",
        description: `Remnant ${bestRemnant.lot_number || bestRemnant.id.slice(0, 8)} — ${bestRemnant.standard_length_mm}mm, qty ${bestRemnant.qty_on_hand - bestRemnant.qty_reserved}`,
        reason: "Reduces waste by using existing offcuts before new stock.",
      });
      d.edgeCaseId = d.edgeCaseId || "remnant_substitution";
    }
  }

  // ─ Floor stock suggestion ─
  if (floorAvailable.length > 0) {
    const best = floorAvailable[0];
    d.alternatives.push({
      label: "Use floor stock",
      description: `${best.qty_on_hand - best.qty_reserved} bars at machine ${best.machine_id ? "nearby" : "yard"}`,
      reason: "Floor stock is already staged and faster to access.",
    });
  }

  // ─ Wrong stock length detection ─
  const optimalPieces = Math.floor(ctx.selectedStockLength / item.cut_length_mm);
  if (optimalPieces < piecesPerBar) {
    d.warnings.push(
      `Selected stock (${ctx.selectedStockLength}mm) only yields ${optimalPieces} pieces — item expects ${piecesPerBar}/bar. Consider longer stock.`
    );
    d.edgeCaseId = d.edgeCaseId || "wrong_stock_length";
  }

  // ─ Extra bars detection ─
  if (barsThisRun > barsNeeded) {
    d.warnings.push(
      `Loading ${barsThisRun} bars but only ${barsNeeded} needed to finish. Extra material will go to remnant/scrap.`
    );
    d.edgeCaseId = d.edgeCaseId || "extra_bars_loaded";
  }

  // ─ Instructions ─
  if (remaining <= 0) {
    d.instructions = [
      { step: 1, text: "This mark is COMPLETE.", emphasis: "✓" },
      { step: 2, text: "Move to the next item in the queue." },
    ];
    d.recommendation = "Mark complete — advance to next item.";
    d.recommendationReason = `All ${item.total_pieces} pieces are done.`;
  } else {
    d.instructions = [
      { step: 1, text: `Set stopper to`, emphasis: `${item.cut_length_mm}mm` },
      { step: 2, text: `Load`, emphasis: `${item.bar_code} bar` },
      { step: 3, text: `You get`, emphasis: `${piecesPerBar} piece${piecesPerBar > 1 ? "s" : ""} per bar` },
      { step: 4, text: `Cut`, emphasis: `${barsThisRun} bar${barsThisRun > 1 ? "s" : ""} this run` },
      { step: 5, text: `${remaining} piece${remaining > 1 ? "s" : ""} remaining to complete this mark.` },
    ];
    d.recommendation = `Load ${barsThisRun} × ${item.bar_code} from ${ctx.selectedStockLength / 1000}M stock → cut at ${item.cut_length_mm}mm`;
    d.recommendationReason = `Produces ${barsThisRun * piecesPerBar} pieces, leaving ${Math.max(0, remaining - barsThisRun * piecesPerBar)} remaining.`;
  }

  return d;
}

// ── BEND MODULE ────────────────────────────────────────────────────────────

function computeBendDecision(ctx: ForemanContext, d: ForemanDecision): ForemanDecision {
  const item = ctx.currentItem!;
  const remaining = item.total_pieces - item.completed_pieces;

  // ─ Blockers ─
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

  // ─ WIP availability ─
  const wipAvailable = ctx.wipBatches.filter(w => w.bar_code === item.bar_code && w.qty_available > 0);
  const wipTotal = wipAvailable.reduce((s, w) => s + w.qty_available, 0);

  if (wipTotal === 0 && remaining > 0) {
    d.warnings.push(
      `No cut output (WIP) available for ${item.bar_code}. Ensure cutting is ahead of bending.`
    );
    d.edgeCaseId = d.edgeCaseId || "wip_missing";
  }

  // ─ Setup mismatch ─
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

  // ─ Instructions ─
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
