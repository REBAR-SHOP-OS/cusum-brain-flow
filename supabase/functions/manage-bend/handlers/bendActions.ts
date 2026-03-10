import { json, logEvent, type BendContext } from "../lib/helpers.ts";

export async function handleStartBend(ctx: BendContext) {
  const { body, userId, supabaseUser, sb } = ctx;
  const { bendBatchId } = body;
  if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

  const { data: bb, error: bbErr } = await supabaseUser
    .from("bend_batches").select("*").eq("id", bendBatchId).single();
  if (bbErr || !bb) return json({ error: "Bend batch not found" }, 404);
  if (!["queued", "paused"].includes(bb.status)) {
    return json({ error: `Invalid transition: ${bb.status} → bending` }, 400);
  }

  const { error } = await supabaseUser
    .from("bend_batches").update({ status: "bending" }).eq("id", bendBatchId);
  if (error) throw error;

  await logEvent(sb, bb.company_id, "bender_started", {
    batchId: bendBatchId, machineId: bb.machine_id, size: bb.size, shape: bb.shape, fromStatus: bb.status,
  }, `Bender started on batch ${bendBatchId}`, userId);

  return json({ success: true, bendBatchId, action: "start-bend" });
}

export async function handlePauseBend(ctx: BendContext) {
  const { body, userId, supabaseUser, sb } = ctx;
  const { bendBatchId } = body;
  if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

  const { data: bb } = await supabaseUser
    .from("bend_batches").select("*").eq("id", bendBatchId).single();
  if (!bb) return json({ error: "Bend batch not found" }, 404);
  if (bb.status !== "bending") return json({ error: `Invalid transition: ${bb.status} → paused` }, 400);

  await supabaseUser.from("bend_batches").update({ status: "paused" }).eq("id", bendBatchId);

  await logEvent(sb, bb.company_id, "bender_paused", {
    batchId: bendBatchId, machineId: bb.machine_id,
  }, `Bender paused on batch ${bendBatchId}`, userId);

  return json({ success: true, bendBatchId, action: "pause-bend" });
}

export async function handleCompleteBend(ctx: BendContext) {
  const { body, userId, supabaseUser, sb } = ctx;
  const { bendBatchId, actualQty } = body;
  if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

  const { data: bb } = await supabaseUser
    .from("bend_batches").select("*").eq("id", bendBatchId).single();
  if (!bb) return json({ error: "Bend batch not found" }, 404);
  if (!["bending", "queued"].includes(bb.status)) {
    return json({ error: `Invalid transition: ${bb.status} → bend_complete` }, 400);
  }

  const finalActual = actualQty ?? bb.planned_qty;

  const { error: upErr } = await supabaseUser
    .from("bend_batches").update({ status: "bend_complete", actual_qty: finalActual }).eq("id", bendBatchId);
  if (upErr) throw upErr;

  const variance = finalActual - bb.planned_qty;
  if (variance !== 0) {
    await logEvent(sb, bb.company_id, "variance_detected", {
      batchId: bendBatchId, type: "bend", plannedQty: bb.planned_qty, actualQty: finalActual, variance,
    }, `Bend variance: planned ${bb.planned_qty}, actual ${finalActual}, diff ${variance}`, userId);
  }

  await logEvent(sb, bb.company_id, "bender_completed", {
    batchId: bendBatchId, machineId: bb.machine_id, actualQty: finalActual, plannedQty: bb.planned_qty,
  }, `Bender completed on batch ${bendBatchId}`, userId);

  // Auto-create bundle
  const bundleCode = `BND-${Date.now().toString(36).toUpperCase()}`;
  const { data: bundle, error: bundleErr } = await supabaseUser
    .from("bundles")
    .insert({
      company_id: bb.company_id, source_job_id: bb.source_job_id || null,
      source_bend_batch_id: bendBatchId, source_cut_batch_id: bb.source_cut_batch_id || null,
      size: bb.size, shape: bb.shape, quantity: finalActual,
      status: "created", bundle_code: bundleCode, created_by: userId,
    })
    .select().single();

  if (bundleErr) {
    if (bundleErr.code === "23505") {
      return json({ success: true, bendBatchId, action: "complete-bend", warning: "bundle_already_exists" });
    }
    console.error("Bundle creation error:", bundleErr);
  } else {
    await logEvent(sb, bb.company_id, "bundle_created", {
      bundleId: bundle.id, bundleCode, bendBatchId, quantity: finalActual, size: bb.size, shape: bb.shape,
    }, `Bundle ${bundleCode} created from bend batch`, userId);
  }

  return json({ success: true, bendBatchId, bundleId: bundle?.id, bundleCode, action: "complete-bend" });
}

export async function handleCancelBend(ctx: BendContext) {
  const { body, supabaseUser } = ctx;
  const { bendBatchId } = body;
  if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

  const { data: bb } = await supabaseUser
    .from("bend_batches").select("*").eq("id", bendBatchId).single();
  if (!bb) return json({ error: "Bend batch not found" }, 404);
  if (bb.status === "bend_complete") return json({ error: "Cannot cancel a completed bend batch" }, 400);

  await supabaseUser.from("bend_batches").update({ status: "cancelled" }).eq("id", bendBatchId);
  return json({ success: true, bendBatchId, action: "cancel-bend" });
}
