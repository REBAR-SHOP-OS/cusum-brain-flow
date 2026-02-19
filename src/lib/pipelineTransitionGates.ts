/**
 * Pipeline Transition Gate definitions.
 * Determines which memory capture modal must be shown before a stage transition is allowed.
 */

export type GateType = "qualification" | "pricing" | "loss" | "delivery";

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

/**
 * Given a target stage, returns the gate(s) that must be satisfied.
 * Returns null if no gate is required.
 * 
 * Multiple gates can apply (e.g. moving directly to quotation_bids
 * requires both qualification AND pricing memory).
 */
export function getRequiredGates(
  targetStage: string,
  existingMemory: {
    hasQualification: boolean;
    hasPricing: boolean;
    hasLoss: boolean;
    hasOutcome: boolean;
  }
): GateDefinition[] {
  const gates: GateDefinition[] = [];

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

  return gates;
}
