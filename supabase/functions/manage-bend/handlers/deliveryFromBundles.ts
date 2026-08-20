import { json, logEvent, type BendContext } from "../lib/helpers.ts";

export async function handleCreateDeliveryFromBundles(ctx: BendContext) {
  const { body, userId, supabaseUser, sb } = ctx;
  const { bundleIds, companyId, deliveryNumber, orderId, scheduledDate, driverName, vehicle } = body;
  if (!bundleIds?.length || !companyId) return json({ error: "Missing bundleIds or companyId" }, 400);

  const { data: bundles, error: bErr } = await supabaseUser
    .from("bundles").select("*").in("id", bundleIds);
  if (bErr) throw bErr;
  if (!bundles?.length) return json({ error: "No bundles found" }, 404);

  const invalid = bundles.filter((b: any) => !["created", "staged"].includes(b.status));
  if (invalid.length > 0) return json({ error: `Bundles not ready: ${invalid.map((b: any) => b.id).join(", ")}` }, 400);

  const { data: delivery, error: delErr } = await supabaseUser
    .from("deliveries")
    .insert({
      company_id: companyId,
      delivery_number: deliveryNumber || `DEL-${Date.now().toString(36).toUpperCase()}`,
      status: "pending", order_id: orderId || null,
      scheduled_date: scheduledDate || null, driver_name: driverName || null, vehicle: vehicle || null,
    })
    .select().single();
  if (delErr) throw delErr;

  const junctions = bundleIds.map((bid: string) => ({ delivery_id: delivery.id, bundle_id: bid }));
  const { error: jErr } = await supabaseUser.from("delivery_bundles").insert(junctions);
  if (jErr) {
    if (jErr.code === "23505") return json({ error: "Some bundles are already linked to a delivery" }, 409);
    throw jErr;
  }

  await supabaseUser.from("bundles").update({ status: "staged" }).in("id", bundleIds);

  await logEvent(sb, companyId, "delivery_created", {
    deliveryId: delivery.id, bundleCount: bundleIds.length,
    totalQty: bundles.reduce((s: number, b: any) => s + (b.quantity || 0), 0),
  }, `Delivery created from ${bundleIds.length} bundles`, userId);

  return json({ success: true, deliveryId: delivery.id, action: "create-delivery-from-bundles" });
}
