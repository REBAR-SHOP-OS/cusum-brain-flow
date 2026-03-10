import { json, type ActionContext } from "../lib/helpers.ts";

export async function handleUpdateStatus(ctx: ActionContext) {
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
