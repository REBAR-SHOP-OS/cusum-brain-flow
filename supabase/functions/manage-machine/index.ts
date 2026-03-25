import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ═══════════════════════════════════════════════════════════
// HELPERS (inlined from lib/helpers.ts)
// ═══════════════════════════════════════════════════════════

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logProductionEvent(
  supabaseService: ReturnType<typeof createClient>,
  companyId: string,
  eventType: string,
  metadata: Record<string, unknown>,
  description: string,
  entityId?: string,
  actorId?: string,
) {
  try {
    await supabaseService.from("production_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
      machine_id: metadata.machineId || null,
      session_id: metadata.sessionId || null,
      row_id: metadata.rowId || null,
      batch_id: metadata.batchId || null,
      triggered_by: actorId || null,
    });
  } catch (err) {
    console.error(`Failed to log production event ${eventType}:`, err);
  }
}

async function flushEvents(
  supabaseService: ReturnType<typeof createClient>,
  events: Record<string, unknown>[],
  companyId: string,
) {
  if (events.length === 0) return;
  const { error } = await supabaseService
    .from("activity_events")
    .insert(events.map((e: any) => ({ ...e, source: "system", company_id: companyId })));
  if (error) console.error("Failed to log events:", error);
}

interface ActionContext {
  userId: string;
  machineId: string;
  machine: any;
  body: any;
  roles: string[];
  supabaseUser: ReturnType<typeof createClient>;
  supabaseService: ReturnType<typeof createClient>;
  events: Record<string, unknown>[];
  now: string;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: update-status
// ═══════════════════════════════════════════════════════════

async function handleUpdateStatus(ctx: ActionContext) {
  const { body, machine, machineId, userId, supabaseUser, events, now } = ctx;
  const { status } = body;
  const valid = ["idle", "running", "blocked", "down"];
  if (!valid.includes(status)) {
    return json({ error: `Invalid status: ${status}` }, 400);
  }

  const oldStatus = machine.status;
  const { error } = await supabaseUser
    .from("machines")
    .update({ status, last_event_at: now })
    .eq("id", machineId);
  if (error) throw error;

  if (oldStatus !== status) {
    events.push({
      entity_type: "machine",
      entity_id: machineId,
      event_type: "machine_status_changed",
      actor_id: userId,
      actor_type: "user",
      description: `Machine ${machine.name}: ${oldStatus} → ${status}`,
      metadata: { machineId, machineName: machine.name, oldStatus, newStatus: status },
    });
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// HANDLER: assign-operator
// ═══════════════════════════════════════════════════════════

async function handleAssignOperator(ctx: ActionContext) {
  const { body, machine, machineId, userId, supabaseUser, events, now } = ctx;
  const { operatorProfileId } = body;
  const { error } = await supabaseUser
    .from("machines")
    .update({
      current_operator_profile_id: operatorProfileId || null,
      last_event_at: now,
    })
    .eq("id", machineId);
  if (error) throw error;

  events.push({
    entity_type: "machine",
    entity_id: machineId,
    event_type: "operator_assigned",
    actor_id: userId,
    actor_type: "user",
    description: `Operator ${operatorProfileId ? "assigned" : "unassigned"} on ${machine.name}`,
    metadata: { machineId, machineName: machine.name, operatorProfileId },
  });
  return null;
}
