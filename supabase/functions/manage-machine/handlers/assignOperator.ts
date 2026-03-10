import { type ActionContext } from "../lib/helpers.ts";

export async function handleAssignOperator(ctx: ActionContext) {
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
    description: `Operator ${operatorProfileId ? "assigned to" : "removed from"} ${machine.name}`,
    metadata: { machineId, operatorProfileId: operatorProfileId || null },
  });
  return null;
}
