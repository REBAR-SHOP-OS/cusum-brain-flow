import { json, logEvent, type BendContext } from "../lib/helpers.ts";

export async function handleReserveWaste(ctx: BendContext) {
  const { body, userId, sb } = ctx;
  const { pieceId } = body;
  if (!pieceId) return json({ error: "Missing pieceId" }, 400);

  const { data: piece, error: pErr } = await sb
    .from("waste_bank_pieces").select("*").eq("id", pieceId).single();
  if (pErr || !piece) return json({ error: "Waste piece not found" }, 404);
  if (piece.status !== "available") return json({ error: `Cannot reserve: piece is ${piece.status}` }, 400);

  const { error } = await sb
    .from("waste_bank_pieces")
    .update({ status: "reserved", reserved_by: userId, reserved_at: new Date().toISOString() })
    .eq("id", pieceId).eq("status", "available");
  if (error) throw error;

  await logEvent(sb, piece.company_id, "waste_bank_reserved", {
    pieceId, barCode: piece.bar_code, lengthMm: piece.length_mm,
  }, `Waste piece reserved`, userId);

  return json({ success: true, pieceId, action: "reserve-waste" });
}

export async function handleConsumeWaste(ctx: BendContext) {
  const { body, userId, sb } = ctx;
  const { pieceId } = body;
  if (!pieceId) return json({ error: "Missing pieceId" }, 400);

  const { data: piece, error: pErr } = await sb
    .from("waste_bank_pieces").select("*").eq("id", pieceId).single();
  if (pErr || !piece) return json({ error: "Waste piece not found" }, 404);
  if (piece.status !== "reserved") return json({ error: `Cannot consume: piece is ${piece.status}` }, 400);

  const { error } = await sb
    .from("waste_bank_pieces")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("id", pieceId).eq("status", "reserved");
  if (error) throw error;

  await logEvent(sb, piece.company_id, "waste_bank_consumed", {
    pieceId, barCode: piece.bar_code, lengthMm: piece.length_mm,
  }, `Waste piece consumed`, userId);

  return json({ success: true, pieceId, action: "consume-waste" });
}

export async function handleReleaseWaste(ctx: BendContext) {
  const { body, userId, sb } = ctx;
  const { pieceId } = body;
  if (!pieceId) return json({ error: "Missing pieceId" }, 400);

  const { data: piece, error: pErr } = await sb
    .from("waste_bank_pieces").select("*").eq("id", pieceId).single();
  if (pErr || !piece) return json({ error: "Waste piece not found" }, 404);
  if (piece.status !== "reserved") return json({ error: `Cannot release: piece is ${piece.status}` }, 400);

  const { error } = await sb
    .from("waste_bank_pieces")
    .update({ status: "available", reserved_by: null, reserved_at: null })
    .eq("id", pieceId).eq("status", "reserved");
  if (error) throw error;

  await logEvent(sb, piece.company_id, "waste_bank_released", {
    pieceId, barCode: piece.bar_code, lengthMm: piece.length_mm,
  }, `Waste piece released`, userId);

  return json({ success: true, pieceId, action: "release-waste" });
}
