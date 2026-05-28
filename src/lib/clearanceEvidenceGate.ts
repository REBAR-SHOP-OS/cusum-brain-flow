// Shared DB-confirmation gates for clearance evidence rows.
//
// HARD RULE (see mem://rules/silent-video-generation siblings):
// Frontend MUST NOT advance Auto Clearance from tag → product, nor finalize
// an item, based on React state alone. Re-read the clearance_evidence row
// and confirm the required fields exist on the SAME row before continuing.
//
// Used by:
//   - src/hooks/useAutoClearance.ts (tag→product gate, finalize gate)
//   - src/components/clearance/ClearanceCard.tsx (Manual Verify finalize gate)

import { supabase } from "@/integrations/supabase/client";

export class ClearanceGateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ClearanceGateError";
  }
}

/**
 * Gate before unlocking PRODUCT photo capture in Auto Clearance.
 * Throws unless the evidence row has tag_photo persisted and is bound
 * to the active cut_plan_item.
 */
export async function assertTagEvidenceReady(
  evidenceId: string,
  itemId: string,
): Promise<void> {
  if (!evidenceId) {
    throw new ClearanceGateError("NO_EVIDENCE_ID", "Scan and save tag first.");
  }
  const { data, error } = await supabase
    .from("clearance_evidence")
    .select("id, cut_plan_item_id, tag_scan_url, verification_state")
    .eq("id", evidenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ClearanceGateError("EVIDENCE_MISSING", "Evidence row missing — rescan tag.");
  }
  if (data.cut_plan_item_id !== itemId) {
    throw new ClearanceGateError(
      "ITEM_MISMATCH",
      "Evidence row belongs to a different item — rescan tag.",
    );
  }
  if (!data.tag_scan_url) {
    throw new ClearanceGateError(
      "TAG_PHOTO_MISSING",
      "Tag photo required before product photo.",
    );
  }
  const allowed = new Set(["tag_scanned", "product_captured", "complete"]);
  if (!allowed.has(data.verification_state || "")) {
    throw new ClearanceGateError(
      "STATE_NOT_READY",
      `Tag not yet saved (state=${data.verification_state ?? "null"}).`,
    );
  }
}

/**
 * Gate before flipping cut_plan_items.phase to 'cleared' (auto OR manual).
 * Confirms both photos exist on the SAME evidence row and that the row is
 * bound to the active item.
 */
export async function assertEvidenceComplete(
  evidenceId: string,
  itemId: string,
): Promise<void> {
  if (!evidenceId) {
    throw new ClearanceGateError("NO_EVIDENCE_ID", "Evidence row missing.");
  }
  const { data, error } = await supabase
    .from("clearance_evidence")
    .select("id, cut_plan_item_id, tag_scan_url, material_photo_url")
    .eq("id", evidenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ClearanceGateError("EVIDENCE_MISSING", "Evidence row missing.");
  }
  if (data.cut_plan_item_id !== itemId) {
    throw new ClearanceGateError(
      "ITEM_MISMATCH",
      "Evidence row belongs to a different item.",
    );
  }
  if (!data.tag_scan_url) {
    throw new ClearanceGateError("TAG_PHOTO_MISSING", "Tag photo missing on evidence row.");
  }
  if (!data.material_photo_url) {
    throw new ClearanceGateError(
      "PRODUCT_PHOTO_MISSING",
      "Product photo missing on evidence row.",
    );
  }
}
