import { json, logEvent, type BendContext } from "../lib/helpers.ts";

export async function handleCreateBendQueue(ctx: BendContext) {
  const { body, userId, supabaseUser, sb } = ctx;
  const { cutBatchId, machineId, bendPattern, shape, size, companyId } = body;
  if (!cutBatchId || !companyId) return json({ error: "Missing cutBatchId or companyId" }, 400);

  const { data: cutBatch, error: cbErr } = await sb
    .from("cut_batches").select("*").eq("id", cutBatchId).single();
  if (cbErr || !cutBatch) return json({ error: "Cut batch not found" }, 404);
  if (cutBatch.status !== "completed") return json({ error: "Cut batch is not completed." }, 400);

  const plannedQty = cutBatch.actual_qty ?? cutBatch.planned_qty ?? 0;

  const { data: bendBatch, error: bbErr } = await supabaseUser
    .from("bend_batches")
    .insert({
      company_id: companyId, source_cut_batch_id: cutBatchId,
      source_job_id: cutBatch.cut_plan_item_id || null,
      machine_id: machineId || null, bend_pattern: bendPattern || null,
      shape: shape || null, size: size || cutBatch.bar_code || null,
      planned_qty: plannedQty, status: "queued", created_by: userId,
    })
    .select().single();

  if (bbErr) {
    if (bbErr.code === "23505") return json({ error: "Bend batch already exists for this cut batch" }, 409);
    throw bbErr;
  }

  await logEvent(sb, companyId, "bend_queue_created", {
    batchId: bendBatch.id, cutBatchId, machineId, plannedQty, shape, size,
  }, `Bend queue created from cut batch`, userId);

  return json({ success: true, bendBatchId: bendBatch.id, action: "create-bend-queue" });
}
