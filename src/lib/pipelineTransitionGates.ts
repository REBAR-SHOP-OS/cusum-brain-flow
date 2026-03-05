/**
 * Pipeline Transition Gate definitions.
 * Determines which memory capture modal must be shown before a stage transition is allowed.
 */

export type GateType = "qualification" | "pricing" | "loss" | "delivery" | "next_activity" | "handoff";

interface GateDefinition {
  type: GateType;
  label: string;
  description: string;
}

// Target stages that require memory capture
const QUALIFICATION_GATE_TARGETS = new Set([
  "quotation_priority",
  "quotation_bids",
]);

const PRICING_GATE_TARGETS = new Set([
  "quotation_bids",
]);

const LOSS_GATE_TARGETS = new Set([
  "loss",
  "lost",
]);

const DELIVERY_GATE_TARGETS = new Set([
  "delivered_pickup_done",
]);

// Stages that require a next activity before leaving
const NEXT_ACTIVITY_SOURCE_STAGES = new Set([
  "new",
  "telephonic_enquiries",
]);

// Stages that require a handoff template on entry
const HANDOFF_TARGET_STAGES = new Set([
  "qc_ben",
  "estimation_ben",
  "estimation_karthick",
  "estimation_others",
  "estimation_partha",
]);

/**
 * Given a target stage and optionally the source stage, returns the gate(s) that must be satisfied.
 * Returns an empty array if no gate is required.
 */
export function getRequiredGates(
  targetStage: string,
  existingMemory: {
    hasQualification: boolean;
    hasPricing: boolean;
    hasLoss: boolean;
    hasOutcome: boolean;
  },
  sourceStage?: string
): GateDefinition[] {
  const gates: GateDefinition[] = [];

  // Gate: Next activity required when leaving New or Telephonic Enquiries
  if (sourceStage && NEXT_ACTIVITY_SOURCE_STAGES.has(sourceStage)) {
    gates.push({
      type: "next_activity",
      label: "Next Activity Required",
      description: "Schedule a follow-up activity before moving this lead forward.",
    });
  }

  // Gate A: Qualification required for quotation stages
  if (QUALIFICATION_GATE_TARGETS.has(targetStage) && !existingMemory.hasQualification) {
    gates.push({
      type: "qualification",
      label: "Qualification Memory",
      description: "Capture project qualification details before moving to quotation.",
    });
  }

  // Gate B: Pricing intelligence required for quotation_bids
  if (PRICING_GATE_TARGETS.has(targetStage) && !existingMemory.hasPricing) {
    gates.push({
      type: "pricing",
      label: "Pricing Intelligence",
      description: "Capture quote pricing details before submitting bid.",
    });
  }

  // Gate C: Loss intelligence required for loss/lost
  if (LOSS_GATE_TARGETS.has(targetStage) && !existingMemory.hasLoss) {
    gates.push({
      type: "loss",
      label: "Loss Intelligence",
      description: "Capture loss reason and competitor data before closing as lost.",
    });
  }

  // Gate D: Delivery performance required for delivered
  if (DELIVERY_GATE_TARGETS.has(targetStage) && !existingMemory.hasOutcome) {
    gates.push({
      type: "delivery",
      label: "Delivery Performance",
      description: "Capture delivery performance and client satisfaction before closing.",
    });
  }

  // Gate E: Handoff template required for QC/Estimation stages
  if (HANDOFF_TARGET_STAGES.has(targetStage)) {
    gates.push({
      type: "handoff",
      label: "Handoff Template",
      description: "Provide scope and requirements for QC/Estimation handoff.",
    });
  }

  return gates;
}
