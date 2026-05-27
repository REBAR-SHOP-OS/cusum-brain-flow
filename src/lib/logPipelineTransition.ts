import { supabase } from "@/integrations/supabase/client";

import { getCurrentUser } from "@/lib/auth";
/**
 * Logs a pipeline stage transition to the audit trail.
 * Fire-and-forget — errors are logged but don't block the transition.
 */
export async function logPipelineTransition({
  leadId,
  companyId,
  fromStage,
  toStage,
  result,
  blockReasonCode,
  blockReasonDetail,
  triggeredBy = "ui",
}: {
  leadId: string;
  companyId: string;
  fromStage: string | null;
  toStage: string;
  result: "allowed" | "blocked" | "gate_completed";
  blockReasonCode?: string;
  blockReasonDetail?: Record<string, string | number | boolean | null>;
  triggeredBy?: string;
}) {
  try {
    const user = await getCurrentUser();
    await supabase.from("pipeline_transition_log").insert([{
      lead_id: leadId,
      company_id: companyId,
      from_stage: fromStage,
      to_stage: toStage,
      transition_result: result,
      block_reason_code: blockReasonCode ?? null,
      block_reason_detail: blockReasonDetail ?? null,
      triggered_by: triggeredBy,
      user_id: user?.id ?? null,
    }]);
  } catch (err) {
    console.error("Failed to log transition:", err);
  }
}
