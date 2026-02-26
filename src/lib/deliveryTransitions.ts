/**
 * Allowed delivery status transitions.
 * Mirrors the pattern used by ALLOWED_TRANSITIONS (orders) and ALLOWED_EXPENSE_TRANSITIONS (expenses).
 */
export const ALLOWED_DELIVERY_TRANSITIONS: Record<string, string[]> = {
  pending: ["scheduled", "in-transit"],
  scheduled: ["in-transit", "pending"],
  "in-transit": ["delivered", "completed", "completed_with_issues", "partial", "failed"],
  partial: ["in-transit", "completed_with_issues"],
  delivered: ["completed"],
  completed: [],
  completed_with_issues: [],
  failed: ["pending"],
};

/**
 * Validates whether a delivery status transition is allowed.
 * Returns true if valid, false otherwise.
 */
export function isValidDeliveryTransition(
  currentStatus: string | null | undefined,
  newStatus: string
): boolean {
  const from = currentStatus || "pending";
  const allowed = ALLOWED_DELIVERY_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}
