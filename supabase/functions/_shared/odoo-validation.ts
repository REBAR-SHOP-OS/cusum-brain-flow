/**
 * Odoo Sync Validation Layer
 * Pre-sync data quality checks, anomaly detection, and stage transition validation.
 */

export const STAGE_MAP: Record<string, string> = {
  "New": "new",
  "Telephonic Enquiries": "telephonic_enquiries",
  "Qualified": "qualified",
  "RFI": "rfi",
  "Addendums": "addendums",
  "Estimation-Ben": "estimation_ben",
  "Estimation-Karthick(Mavericks)": "estimation_karthick",
  "Estimation-Others": "estimation_others",
  "Estimation Partha": "estimation_partha",
  "QC - Ben": "qc_ben",
  "Hot Enquiries": "hot_enquiries",
  "Quotation Priority": "quotation_priority",
  "Quotation Bids": "quotation_bids",
  "Shop Drawing": "shop_drawing",
  "Shop Drawing Sent for Approval": "shop_drawing_approval",
  "Fabrication In Shop": "fabrication_in_shop",
  "Ready To Dispatch/Pickup": "ready_to_dispatch",
  "Delivered/Pickup Done": "delivered_pickup_done",
  "Out for Delivery": "out_for_delivery",
  "Won": "won",
  "Loss": "loss",
  "Merged": "merged",
  "No rebars(Our of Scope)": "no_rebars_out_of_scope",
  "Temp: IR/VAM": "temp_ir_vam",
  "Migration-Others": "migration_others",
  "Dreamers": "dreamers",
  "Archived": "archived_orphan",
  "Orphan": "archived_orphan",
};

export const TERMINAL_STAGES = new Set([
  "won", "lost", "loss", "merged", "no_rebars_out_of_scope", "delivered_pickup_done",
]);

export const ACTIVE_STAGES = new Set(
  Object.values(STAGE_MAP).filter(s => !TERMINAL_STAGES.has(s))
);

/** Stages that should have revenue > 0 */
const REVENUE_EXPECTED_STAGES = new Set([
  "quotation_priority", "quotation_bids", "shop_drawing", "shop_drawing_approval",
  "fabrication_in_shop", "ready_to_dispatch", "out_for_delivery", "won",
]);

/** Valid stage transitions — from → allowed destinations */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  new: new Set(["telephonic_enquiries", "qualified", "hot_enquiries", "dreamers", "loss", "archived_orphan", "merged", "no_rebars_out_of_scope"]),
  telephonic_enquiries: new Set(["qualified", "hot_enquiries", "rfi", "loss", "archived_orphan", "merged", "no_rebars_out_of_scope", "dreamers"]),
  qualified: new Set(["rfi", "addendums", "estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "hot_enquiries", "loss", "archived_orphan", "merged", "no_rebars_out_of_scope"]),
  hot_enquiries: new Set(["qualified", "rfi", "estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "quotation_priority", "loss", "archived_orphan", "merged"]),
  rfi: new Set(["addendums", "estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "qualified", "loss", "archived_orphan", "merged"]),
  addendums: new Set(["estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "rfi", "loss", "archived_orphan", "merged"]),
  // Estimation stages → QC
  estimation_ben: new Set(["qc_ben", "quotation_priority", "loss", "archived_orphan", "merged"]),
  estimation_karthick: new Set(["qc_ben", "quotation_priority", "loss", "archived_orphan", "merged"]),
  estimation_others: new Set(["qc_ben", "quotation_priority", "loss", "archived_orphan", "merged"]),
  estimation_partha: new Set(["qc_ben", "quotation_priority", "loss", "archived_orphan", "merged"]),
  qc_ben: new Set(["quotation_priority", "quotation_bids", "estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "loss", "archived_orphan", "merged"]),
  // Quotation → Production
  quotation_priority: new Set(["quotation_bids", "shop_drawing", "won", "loss", "archived_orphan", "merged"]),
  quotation_bids: new Set(["quotation_priority", "shop_drawing", "won", "loss", "archived_orphan", "merged"]),
  shop_drawing: new Set(["shop_drawing_approval", "loss", "archived_orphan", "merged"]),
  shop_drawing_approval: new Set(["fabrication_in_shop", "shop_drawing", "loss", "archived_orphan", "merged"]),
  fabrication_in_shop: new Set(["ready_to_dispatch", "loss", "archived_orphan"]),
  ready_to_dispatch: new Set(["out_for_delivery", "delivered_pickup_done", "loss", "archived_orphan"]),
  out_for_delivery: new Set(["delivered_pickup_done", "loss", "archived_orphan"]),
  delivered_pickup_done: new Set(["won", "archived_orphan"]),
};

export interface ValidationWarning {
  odoo_id: string;
  severity: "info" | "warning" | "error" | "critical";
  validation_type: string;
  message: string;
  field_name?: string;
  field_value?: string;
  auto_fixed: boolean;
  fix_applied?: string;
}

/**
 * Pre-sync validation: checks a single Odoo lead record for data quality issues.
 * Returns warnings (does NOT block the sync — caller decides severity threshold).
 */
export function validateOdooLead(
  ol: Record<string, unknown>,
  erpStage: string,
  previousStage?: string | null,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const odooId = String(ol.id);

  // 1. Required field checks
  if (!ol.name || String(ol.name).trim() === "") {
    warnings.push({
      odoo_id: odooId, severity: "error", validation_type: "missing_field",
      message: "Lead has no name/title", field_name: "name", field_value: String(ol.name || ""),
      auto_fixed: true, fix_applied: "Set title to 'Untitled'",
    });
  }

  const stageName = Array.isArray(ol.stage_id) ? ol.stage_id[1] : String(ol.stage_id || "");
  if (!STAGE_MAP[stageName]) {
    warnings.push({
      odoo_id: odooId, severity: "warning", validation_type: "missing_field",
      message: `Unknown Odoo stage "${stageName}" — defaulting to "new"`,
      field_name: "stage_id", field_value: stageName,
      auto_fixed: true, fix_applied: 'Mapped to "new"',
    });
  }

  // 2. Zero revenue on advanced stages
  const revenue = Number(ol.expected_revenue) || 0;
  if (revenue === 0 && REVENUE_EXPECTED_STAGES.has(erpStage)) {
    warnings.push({
      odoo_id: odooId, severity: "warning", validation_type: "zero_revenue_advanced",
      message: `Zero revenue on stage "${erpStage}" — expected a value`,
      field_name: "expected_revenue", field_value: "0",
      auto_fixed: false,
    });
  }

  // 3. Missing contact info on active leads
  const partnerName = ol.partner_name || ol.contact_name;
  if (!partnerName && ACTIVE_STAGES.has(erpStage)) {
    warnings.push({
      odoo_id: odooId, severity: "warning", validation_type: "missing_contact_active",
      message: "Active lead has no partner_name or contact_name",
      field_name: "partner_name", field_value: "",
      auto_fixed: true, fix_applied: 'Set customer to "Unknown"',
    });
  }

  // 4. Stage transition validation
  if (previousStage && previousStage !== erpStage) {
    const allowed = VALID_TRANSITIONS[previousStage];
    // Allow any transition TO the same stage family (e.g. estimation_* ↔ estimation_*)
    const isSameFamily = previousStage.startsWith("estimation_") && erpStage.startsWith("estimation_");
    if (allowed && !allowed.has(erpStage) && !isSameFamily) {
      warnings.push({
        odoo_id: odooId, severity: "info", validation_type: "invalid_stage_transition",
        message: `Unusual stage transition: ${previousStage} → ${erpStage}`,
        field_name: "stage", field_value: `${previousStage} → ${erpStage}`,
        auto_fixed: false,
      });
    }
  }

  // 5. Probability anomaly detection
  const prob = Number(ol.probability) || 0;
  if (erpStage === "won" && prob < 100) {
    warnings.push({
      odoo_id: odooId, severity: "info", validation_type: "anomaly",
      message: `Won lead has probability ${prob}% (expected 100%)`,
      field_name: "probability", field_value: String(prob),
      auto_fixed: true, fix_applied: "Normalized to 100%",
    });
  }
  if (TERMINAL_STAGES.has(erpStage) && erpStage !== "won" && prob > 50) {
    warnings.push({
      odoo_id: odooId, severity: "info", validation_type: "anomaly",
      message: `Terminal stage "${erpStage}" has high probability ${prob}%`,
      field_name: "probability", field_value: String(prob),
      auto_fixed: true, fix_applied: "Normalized to 0%",
    });
  }

  return warnings;
}

/**
 * Batch-persist validation warnings to sync_validation_log table.
 */
export async function persistValidationWarnings(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  warnings: ValidationWarning[],
  companyId: string,
  syncRunAt: string,
  leadIdMap?: Map<string, string>,
) {
  if (warnings.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < warnings.length; i += BATCH) {
    const batch = warnings.slice(i, i + BATCH).map(w => ({
      sync_run_at: syncRunAt,
      odoo_id: w.odoo_id,
      lead_id: leadIdMap?.get(w.odoo_id) || null,
      severity: w.severity,
      validation_type: w.validation_type,
      message: w.message,
      field_name: w.field_name || null,
      field_value: w.field_value || null,
      auto_fixed: w.auto_fixed,
      fix_applied: w.fix_applied || null,
      company_id: companyId,
    }));
    await serviceClient.from("sync_validation_log").insert(batch);
  }
}

/**
 * Summarize validation warnings into counts by severity.
 */
export function summarizeWarnings(warnings: ValidationWarning[]) {
  const summary = { info: 0, warning: 0, error: 0, critical: 0, auto_fixed: 0 };
  for (const w of warnings) {
    summary[w.severity]++;
    if (w.auto_fixed) summary.auto_fixed++;
  }
  return summary;
}
