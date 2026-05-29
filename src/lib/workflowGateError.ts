/**
 * Surface backend WORKFLOW_GATE_* errors as friendly UI messages.
 * Mirrors supabase/functions/_shared/requestHandler.ts → mapWorkflowGateError.
 */
const GATE_MESSAGES: Record<string, string> = {
  WORKFLOW_GATE_ADJACENCY: "That phase change is not allowed from the current state.",
  WORKFLOW_GATE_CUTTER_NO_MACHINE_RUN: "Cutting can't start: no active machine run linked to this work order.",
  WORKFLOW_GATE_BEND_INCOMPLETE: "Bend isn't complete yet — finish all pieces before moving to clearance.",
  WORKFLOW_GATE_CLEARANCE_EVIDENCE: "Clearance evidence (tag scan + material photo) is missing or invalid.",
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
