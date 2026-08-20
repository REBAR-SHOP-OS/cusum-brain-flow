/**
 * Single source of truth for workflow release-state labels.
 *
 * Sourced from the `v_workflow_release_state` SQL view (security_invoker).
 * The view derives three consistent labels so Pickup and Clearance screens
 * cannot drift from each other:
 *
 *   - manifest_release_state  → shown on manifest cards
 *   - bundle_release_state    → shown on bundle chips
 *   - item_sub_state          → shown as a sub-state badge on item rows
 *
 * Underlying columns (cut_plans.status, cut_plan_items.phase,
 * clearance_evidence.status, bundles.status) are NOT renamed or replaced —
 * the view is a read-only derivation layer.
 */

export type ManifestReleaseState =
  | "draft"
  | "queued"
  | "in_production"
  | "in_clearance"
  | "evidence_review"
  | "awaiting_clearance"
  | "released"
  | "unknown";

export type BundleReleaseState =
  | "in_production"
  | "in_clearance"
  | "released"
  | "unknown";

export type ItemSubState =
  | "queued"
  | "cut_complete"
  | "awaiting_evidence"
  | "evidence_pending_review"
  | "cleared"
  | "released"
  | "unknown";

export const MANIFEST_RELEASE_LABEL: Record<ManifestReleaseState, string> = {
  draft: "Draft",
  queued: "Queued",
  in_production: "In production",
  in_clearance: "In clearance",
  evidence_review: "Evidence review",
  awaiting_clearance: "Awaiting clearance",
  released: "Released",
  unknown: "Unknown",
};

export const BUNDLE_RELEASE_LABEL: Record<BundleReleaseState, string> = {
  in_production: "In production",
  in_clearance: "In clearance",
  released: "Released",
  unknown: "Unknown",
};

export const ITEM_SUB_STATE_LABEL: Record<ItemSubState, string> = {
  queued: "Queued",
  cut_complete: "Cut complete",
  awaiting_evidence: "Awaiting evidence",
  evidence_pending_review: "Evidence pending review",
  cleared: "Cleared",
  released: "Released",
  unknown: "—",
};

export function manifestReleaseLabel(state: string | null | undefined): string {
  return MANIFEST_RELEASE_LABEL[(state as ManifestReleaseState) ?? "unknown"] ?? String(state ?? "—");
}

export function bundleReleaseLabel(state: string | null | undefined): string {
  return BUNDLE_RELEASE_LABEL[(state as BundleReleaseState) ?? "unknown"] ?? String(state ?? "—");
}

export function itemSubStateLabel(state: string | null | undefined): string {
  return ITEM_SUB_STATE_LABEL[(state as ItemSubState) ?? "unknown"] ?? String(state ?? "—");
}
