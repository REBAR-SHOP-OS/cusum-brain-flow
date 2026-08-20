/**
 * Shared event writing utility for Edge Functions.
 * Standardizes activity_events inserts across all functions
 * to prevent format drift and duplicated error handling.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ActivityEvent {
  company_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description?: string;
  source?: string;
  actor_id?: string;
  actor_type?: string;
  automation_source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a single activity event. Best-effort — logs errors but never throws.
 */
export async function writeEvent(
  client: SupabaseClient,
  event: ActivityEvent
): Promise<void> {
  try {
    const { error } = await client.from("activity_events").insert({
      company_id: event.company_id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      event_type: event.event_type,
      description: event.description ?? null,
      source: event.source ?? "system",
      actor_id: event.actor_id ?? null,
      actor_type: event.actor_type ?? null,
      automation_source: event.automation_source ?? null,
      metadata: event.metadata ?? null,
    });
    if (error) console.error("[writeEvent] Insert failed:", error.message);
  } catch (err) {
    console.error("[writeEvent] Exception:", err);
  }
}

/**
 * Write multiple activity events in a single insert. Best-effort.
 */
export async function writeEvents(
  client: SupabaseClient,
  events: ActivityEvent[]
): Promise<void> {
  if (events.length === 0) return;
  try {
    const rows = events.map((e) => ({
      company_id: e.company_id,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      event_type: e.event_type,
      description: e.description ?? null,
      source: e.source ?? "system",
      actor_id: e.actor_id ?? null,
      actor_type: e.actor_type ?? null,
      automation_source: e.automation_source ?? null,
      metadata: e.metadata ?? null,
    }));
    const { error } = await client.from("activity_events").insert(rows);
    if (error) console.error("[writeEvents] Batch insert failed:", error.message);
  } catch (err) {
    console.error("[writeEvents] Exception:", err);
  }
}
