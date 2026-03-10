import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEvent(sb: any, companyId: string, eventType: string, metadata: Record<string, unknown>, description: string, actorId?: string) {
  try {
    await sb.from("production_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
      machine_id: metadata.machineId || null,
      batch_id: metadata.batchId || null,
      triggered_by: actorId || null,
    });
  } catch (err) {
    console.error(`Failed to log ${eventType}:`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const sb = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub as string;

    // Role check
    const { data: userRoles } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const roles = (userRoles || []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "workshop"].includes(r))) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ─── Create bend queue entry from cut_batch ────────────────────
      case "create-bend-queue": {
        const { cutBatchId, machineId, bendPattern, shape, size, companyId } = body;
        if (!cutBatchId || !companyId) return json({ error: "Missing cutBatchId or companyId" }, 400);

        // Verify cut_batch exists and is completed
        const { data: cutBatch, error: cbErr } = await sb
          .from("cut_batches").select("*").eq("id", cutBatchId).single();
        if (cbErr || !cutBatch) return json({ error: "Cut batch not found" }, 404);
        if (cutBatch.status !== "completed") return json({ error: "Cut batch is not completed. Only cut-complete batches can enter bend queue." }, 400);

        // Use actual_qty from cut_batch (accounts for variance)
        const plannedQty = cutBatch.actual_qty ?? cutBatch.planned_qty ?? 0;

        const { data: bendBatch, error: bbErr } = await supabaseUser
          .from("bend_batches")
          .insert({
            company_id: companyId,
            source_cut_batch_id: cutBatchId,
            source_job_id: cutBatch.cut_plan_item_id || null,
            machine_id: machineId || null,
            bend_pattern: bendPattern || null,
            shape: shape || null,
            size: size || cutBatch.bar_code || null,
            planned_qty: plannedQty,
            status: "queued",
            created_by: userId,
          })
          .select()
          .single();

        if (bbErr) {
          if (bbErr.code === "23505") return json({ error: "Bend batch already exists for this cut batch" }, 409);
          throw bbErr;
        }

        await logEvent(sb, companyId, "bend_queue_created", {
          batchId: bendBatch.id, cutBatchId, machineId, plannedQty, shape, size,
        }, `Bend queue created from cut batch`, userId);

        return json({ success: true, bendBatchId: bendBatch.id, action });
      }

      // ─── Start bending (from queued or paused) ────────────────────
      case "start-bend": {
        const { bendBatchId } = body;
        if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

        const { data: bb, error: bbErr } = await supabaseUser
          .from("bend_batches").select("*").eq("id", bendBatchId).single();
        if (bbErr || !bb) return json({ error: "Bend batch not found" }, 404);
        if (!["queued", "paused"].includes(bb.status)) {
          return json({ error: `Invalid transition: ${bb.status} → bending. Must be queued or paused.` }, 400);
        }

        const { error } = await supabaseUser
          .from("bend_batches").update({ status: "bending" }).eq("id", bendBatchId);
        if (error) throw error;

        await logEvent(sb, bb.company_id, "bender_started", {
          batchId: bendBatchId, machineId: bb.machine_id, size: bb.size, shape: bb.shape,
          fromStatus: bb.status,
        }, `Bender started on batch ${bendBatchId}`, userId);

        return json({ success: true, bendBatchId, action });
      }

      // ─── Pause bending ─────────────────────────────────────────────
      case "pause-bend": {
        const { bendBatchId } = body;
        if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

        const { data: bb } = await supabaseUser
          .from("bend_batches").select("*").eq("id", bendBatchId).single();
        if (!bb) return json({ error: "Bend batch not found" }, 404);
        if (bb.status !== "bending") return json({ error: `Invalid transition: ${bb.status} → paused. Must be bending.` }, 400);

        await supabaseUser.from("bend_batches").update({ status: "paused" }).eq("id", bendBatchId);

        await logEvent(sb, bb.company_id, "bender_paused", {
          batchId: bendBatchId, machineId: bb.machine_id,
        }, `Bender paused on batch ${bendBatchId}`, userId);

        return json({ success: true, bendBatchId, action });
      }

      // ─── Complete bending → create bundle ──────────────────────────
      case "complete-bend": {
        const { bendBatchId, actualQty } = body;
        if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

        const { data: bb } = await supabaseUser
          .from("bend_batches").select("*").eq("id", bendBatchId).single();
        if (!bb) return json({ error: "Bend batch not found" }, 404);
        if (!["bending", "queued"].includes(bb.status)) {
          return json({ error: `Invalid transition: ${bb.status} → bend_complete` }, 400);
        }

        const finalActual = actualQty ?? bb.planned_qty;

        // Update bend batch
        const { error: upErr } = await supabaseUser
          .from("bend_batches")
          .update({ status: "bend_complete", actual_qty: finalActual })
          .eq("id", bendBatchId);
        if (upErr) throw upErr;

        // Log variance
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
            company_id: bb.company_id,
            source_job_id: bb.source_job_id || null,
            source_bend_batch_id: bendBatchId,
            source_cut_batch_id: bb.source_cut_batch_id || null,
            size: bb.size,
            shape: bb.shape,
            quantity: finalActual,
            status: "created",
            bundle_code: bundleCode,
            created_by: userId,
          })
          .select()
          .single();

        if (bundleErr) {
          if (bundleErr.code === "23505") {
            // Bundle already exists — idempotent
            return json({ success: true, bendBatchId, action, warning: "bundle_already_exists" });
          }
          console.error("Bundle creation error:", bundleErr);
        } else {
          await logEvent(sb, bb.company_id, "bundle_created", {
            bundleId: bundle.id, bundleCode, bendBatchId, quantity: finalActual, size: bb.size, shape: bb.shape,
          }, `Bundle ${bundleCode} created from bend batch`, userId);
        }

        return json({ success: true, bendBatchId, bundleId: bundle?.id, bundleCode, action });
      }

      // ─── Cancel bend ───────────────────────────────────────────────
      case "cancel-bend": {
        const { bendBatchId } = body;
        if (!bendBatchId) return json({ error: "Missing bendBatchId" }, 400);

        const { data: bb } = await supabaseUser
          .from("bend_batches").select("*").eq("id", bendBatchId).single();
        if (!bb) return json({ error: "Bend batch not found" }, 404);
        if (bb.status === "bend_complete") return json({ error: "Cannot cancel a completed bend batch" }, 400);

        await supabaseUser.from("bend_batches").update({ status: "cancelled" }).eq("id", bendBatchId);

        return json({ success: true, bendBatchId, action });
      }

      // ─── Create delivery from bundles ──────────────────────────────
      case "create-delivery-from-bundles": {
        const { bundleIds, companyId, deliveryNumber, orderId, scheduledDate, driverName, vehicle } = body;
        if (!bundleIds?.length || !companyId) return json({ error: "Missing bundleIds or companyId" }, 400);

        // Verify all bundles exist and are in 'created' or 'staged' status
        const { data: bundles, error: bErr } = await supabaseUser
          .from("bundles").select("*").in("id", bundleIds);
        if (bErr) throw bErr;
        if (!bundles?.length) return json({ error: "No bundles found" }, 404);

        const invalid = bundles.filter((b: any) => !["created", "staged"].includes(b.status));
        if (invalid.length > 0) return json({ error: `Bundles not ready for delivery: ${invalid.map((b: any) => b.id).join(", ")}` }, 400);

        // Create delivery
        const { data: delivery, error: delErr } = await supabaseUser
          .from("deliveries")
          .insert({
            company_id: companyId,
            delivery_number: deliveryNumber || `DEL-${Date.now().toString(36).toUpperCase()}`,
            status: "pending",
            order_id: orderId || null,
            scheduled_date: scheduledDate || null,
            driver_name: driverName || null,
            vehicle: vehicle || null,
          })
          .select()
          .single();
        if (delErr) throw delErr;

        // Create junction records
        const junctions = bundleIds.map((bid: string) => ({
          delivery_id: delivery.id,
          bundle_id: bid,
        }));
        const { error: jErr } = await supabaseUser.from("delivery_bundles").insert(junctions);
        if (jErr) {
          if (jErr.code === "23505") return json({ error: "Some bundles are already linked to a delivery" }, 409);
          throw jErr;
        }

        // Update bundle statuses to 'staged'
        await supabaseUser.from("bundles").update({ status: "staged" }).in("id", bundleIds);

        await logEvent(sb, companyId, "delivery_created", {
          deliveryId: delivery.id, bundleCount: bundleIds.length,
          totalQty: bundles.reduce((s: number, b: any) => s + (b.quantity || 0), 0),
        }, `Delivery created from ${bundleIds.length} bundles`, userId);

        return json({ success: true, deliveryId: delivery.id, action });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("manage-bend error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
