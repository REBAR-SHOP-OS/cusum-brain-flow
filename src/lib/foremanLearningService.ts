/**
 * Foreman Learning Service — writes system_learnings + events on every
 * blocker, error, edge case, and successful completion.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/hooks/useCompanyId";

export interface LearningEntry {
  module: string;
  learningType: "success" | "blocker" | "error" | "exception" | "edge_case";
  eventType: string;
  context: Record<string, unknown>;
  resolution?: string;
  weightAdjustment?: number;
  machineId?: string;
  barCode?: string;
}

/**
 * Record a learning entry + write an events row for audit.
 */
export async function recordLearning(entry: LearningEntry): Promise<void> {
  try {
    // Write learning
    await supabase.from("system_learnings").insert([{
      module: entry.module,
      learning_type: entry.learningType,
      event_type: entry.eventType,
      context: entry.context as any,
      resolution: entry.resolution || null,
      weight_adjustment: entry.weightAdjustment || 0,
      machine_id: entry.machineId || null,
      bar_code: entry.barCode || null,
    }]);

    // Write event for audit trail
    const companyId = await getCompanyId();
    await supabase.from("events").insert({
      entity_type: "foreman_brain",
      entity_id: entry.machineId || "system",
      event_type: `foreman_${entry.learningType}`,
      description: `[${entry.module}] ${entry.eventType}${entry.resolution ? ` → ${entry.resolution}` : ""}`,
      company_id: companyId!,
      metadata: {
        module: entry.module,
        event_type: entry.eventType,
        bar_code: entry.barCode,
        ...entry.context,
      },
    });
  } catch {
    // Learning writes are best-effort — never block the operator
    console.error("[ForemanBrain] Failed to record learning");
  }
}

/**
 * Record a suggestion interaction (shown / accepted / dismissed).
 */
export async function recordSuggestionInteraction(
  suggestionId: string,
  action: "shown" | "accepted" | "dismissed",
  module: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    const companyId = await getCompanyId();
    await supabase.from("events").insert({
      entity_type: "foreman_suggestion",
      entity_id: suggestionId,
      event_type: `suggestion_${action}`,
      description: `[${module}] Suggestion ${action}`,
      company_id: companyId!,
      metadata: { module, action, ...context },
    });
  } catch {
    // Best-effort
  }
}

/**
 * Record a successful completion.
 */
export async function recordCompletion(
  module: string,
  machineId: string,
  barCode: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  return recordLearning({
    module,
    learningType: "success",
    eventType: "mark_completed",
    context,
    machineId,
    barCode,
    resolution: "Completed successfully",
    weightAdjustment: 0.1,
  });
}

/**
 * Record a blocker encounter.
 */
export async function recordBlocker(
  module: string,
  blockerCode: string,
  machineId: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  return recordLearning({
    module,
    learningType: "blocker",
    eventType: blockerCode.toLowerCase(),
    context,
    machineId,
    resolution: undefined,
    weightAdjustment: -0.2,
  });
}
