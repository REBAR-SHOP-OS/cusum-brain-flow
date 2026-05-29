/**
 * Surface backend WORKFLOW_GATE_* errors as friendly UI messages.
 * Mirrors supabase/functions/_shared/requestHandler.ts → mapWorkflowGateError.
 */
const GATE_MESSAGES: Record<string, string> = {
  WORKFLOW_GATE_ADJACENCY: "That phase change is not allowed from the current state.",
  WORKFLOW_GATE_CUTTER_NO_MACHINE_RUN: "Cutting can't start: no active machine run linked to this work order.",
  WORKFLOW_GATE_BEND_INCOMPLETE: "Bend isn't complete yet — finish all pieces before moving to clearance.",
  WORKFLOW_GATE_CLEARANCE_EVIDENCE: "Clearance evidence (tag scan + material photo) is missing or invalid.",
  WORKFLOW_GATE_STORAGE_ZONE_REQUIRED: "Assign a storage zone (Zone 1–5) before completing clearance.",
  WORKFLOW_GATE_LOADING_NO_ITEMS: "Packing slip blocked: this cut plan has no items to load.",
  WORKFLOW_GATE_LOADING_NOT_STARTED: "Packing slip blocked: no items have been marked loaded yet.",
  WORKFLOW_GATE_LOADING_INCOMPLETE: "Packing slip blocked: loading is incomplete — some items are still missing.",
  WORKFLOW_GATE_LOADING_WRONG_ITEM: "Packing slip blocked: a loaded item does not belong to this cut plan.",
  WORKFLOW_GATE_LOADING_OVERLOAD: "Packing slip blocked: more items loaded than the plan expects.",
  WORKFLOW_GATE_LOADING_DUPLICATE: "Packing slip blocked: the same item appears twice on the slip.",
  WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED: "Pickup blocked: capture a customer signature before authorizing release.",
  WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED: "Pickup blocked: take a final load photo before authorizing release.",
  WORKFLOW_GATE_PICKUP_NO_ITEMS: "Pickup blocked: this order has no items to confirm.",
  WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE: "Pickup blocked: confirm every item on the handover manifest first.",
};

export function mapWorkflowGateError(err: unknown): { code: string; title: string; description: string } | null {
  if (!err) return null;
  const e = err as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : String(err);
  const match = message.match(/(WORKFLOW_(?:GATE|OVERRIDE)_[A-Z0-9_]+)/);
  if (!match) return null;
  const code = match[1];
  return {
    code,
    title: "Transition blocked",
    description: GATE_MESSAGES[code] ?? message,
  };
}
