/**
 * Shared audit logging helper for privileged action tracking.
 * Purely additive — nothing imports this yet except smoke-tests (example).
 * Uses existing activity_events table with event_type = "audit".
 * Best-effort: never throws, logs errors to console.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuditEntry {
  action: string;
  actorId: string;
  targetEntity: string;
  targetId: string;
  companyId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Write a single audit log entry to activity_events.
 * Best-effort — never throws.
 */
export async function writeAuditLog(
  client: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { error } = await client.from("activity_events").insert({
      company_id: entry.companyId,
      entity_type: entry.targetEntity,
      entity_id: entry.targetId,
      event_type: "audit",
      description: entry.action,
      source: "audit",
      actor_id: entry.actorId,
      actor_type: "user",
      metadata: {
        audit_action: entry.action,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ...(entry.metadata ?? {}),
      },
    });
    if (error) console.error("[auditLog] Insert failed:", error.message);
  } catch (err) {
    console.error("[auditLog] Exception:", err);
  }
}
