import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_STOCK_LENGTH_MM = 12000;
const REMNANT_THRESHOLD_MM = 300;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const svc = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Role check
    const { data: userRoles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (userRoles || []).map((r: { role: string }) => r.role);
    if (!roles.some((r: string) => ["admin", "workshop"].includes(r))) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    // Get company_id
    const { data: profile } = await svc
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.company_id) {
      return json({ error: "No company assigned" }, 400);
    }
    const companyId = profile.company_id;

    const body = await req.json();
    const { action } = body;
    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];

    switch (action) {
      // ─── RESERVE STOCK ──────────────────────────────────────────────
      case "reserve": {
        const { cutPlanId, cutPlanItemId, barCode, qty, sourceType, sourceId, stockLengthMm } = body;
        if (!cutPlanId || !barCode || !qty || !sourceType || !sourceId) {
          return json({ error: "Missing: cutPlanId, barCode, qty, sourceType, sourceId" }, 400);
        }

        const stockLen = stockLengthMm || DEFAULT_STOCK_LENGTH_MM;

        // Decrement source qty_reserved
        if (sourceType === "lot" || sourceType === "remnant") {
          const { data: lot, error: lotErr } = await svc
            .from("inventory_lots")
            .select("id, qty_on_hand, qty_reserved")
            .eq("id", sourceId)
            .single();
          if (lotErr || !lot) return json({ error: "Source lot not found" }, 404);
          const available = lot.qty_on_hand - lot.qty_reserved;
          if (qty > available) return json({ error: `Insufficient stock: ${available} available, ${qty} requested` }, 400);

          await svc.from("inventory_lots")
            .update({ qty_reserved: lot.qty_reserved + qty })
            .eq("id", sourceId);
        } else if (sourceType === "floor") {
          const { data: fs, error: fsErr } = await svc
            .from("floor_stock")
            .select("id, qty_on_hand, qty_reserved")
            .eq("id", sourceId)
            .single();
          if (fsErr || !fs) return json({ error: "Floor stock not found" }, 404);
          const available = fs.qty_on_hand - fs.qty_reserved;
          if (qty > available) return json({ error: `Insufficient floor stock: ${available} available` }, 400);

          await svc.from("floor_stock")
            .update({ qty_reserved: fs.qty_reserved + qty })
            .eq("id", sourceId);
        } else if (sourceType === "wip") {
          const { data: wip, error: wipErr } = await svc
            .from("cut_output_batches")
            .select("id, qty_available")
            .eq("id", sourceId)
            .single();
          if (wipErr || !wip) return json({ error: "WIP batch not found" }, 404);
          if (qty > wip.qty_available) return json({ error: `Insufficient WIP: ${wip.qty_available} available` }, 400);
          // WIP doesn't have qty_reserved, we just track via reservations
        }

        // Create reservation
        const { data: reservation, error: resErr } = await svc
          .from("inventory_reservations")
          .insert({
            company_id: companyId,
            cut_plan_id: cutPlanId,
            cut_plan_item_id: cutPlanItemId || null,
            source_type: sourceType,
            source_id: sourceId,
            bar_code: barCode,
            qty_reserved: qty,
            stock_length_mm: stockLen,
            status: "reserved",
          })
          .select()
          .single();
        if (resErr) throw resErr;

        const eventType = sourceType === "floor" ? "floor_stock_reserved" : "inventory_reserved";
        events.push({
          entity_type: "inventory",
          entity_id: reservation.id,
          event_type: eventType,
          actor_id: userId,
          actor_type: "user",
          description: `Reserved ${qty}× ${barCode} from ${sourceType} for plan`,
          metadata: { reservationId: reservation.id, cutPlanId, barCode, qty, sourceType, sourceId, stockLengthMm: stockLen },
        });
        break;
      }

      // ─── CONSUME ON START (CUT) ────────────────────────────────────
      case "consume-on-start": {
        const { machineRunId, cutPlanItemId, barCode, qty, sourceType, sourceId } = body;
        if (!machineRunId || !barCode || !qty || !sourceType || !sourceId) {
          return json({ error: "Missing: machineRunId, barCode, qty, sourceType, sourceId" }, 400);
        }

        if (sourceType === "lot" || sourceType === "remnant") {
          const { data: lot } = await svc
            .from("inventory_lots")
            .select("id, qty_on_hand, qty_reserved")
            .eq("id", sourceId)
            .single();
          if (!lot) return json({ error: "Lot not found" }, 404);

          await svc.from("inventory_lots").update({
            qty_on_hand: Math.max(0, lot.qty_on_hand - qty),
            qty_reserved: Math.max(0, lot.qty_reserved - qty),
          }).eq("id", sourceId);

          events.push({
            entity_type: "inventory",
            entity_id: sourceId,
            event_type: "inventory_consumed",
            actor_id: userId,
            actor_type: "user",
            description: `Consumed ${qty}× ${barCode} from lot on cut start`,
            metadata: { machineRunId, barCode, qty, sourceType, sourceId },
          });
        } else if (sourceType === "floor") {
          const { data: fs } = await svc
            .from("floor_stock")
            .select("id, qty_on_hand, qty_reserved")
            .eq("id", sourceId)
            .single();
          if (!fs) return json({ error: "Floor stock not found" }, 404);

          await svc.from("floor_stock").update({
            qty_on_hand: Math.max(0, fs.qty_on_hand - qty),
            qty_reserved: Math.max(0, fs.qty_reserved - qty),
          }).eq("id", sourceId);

          events.push({
            entity_type: "inventory",
            entity_id: sourceId,
            event_type: "floor_stock_consumed",
            actor_id: userId,
            actor_type: "user",
            description: `Consumed ${qty}× ${barCode} from floor stock on cut start`,
            metadata: { machineRunId, barCode, qty, sourceType, sourceId },
          });
        } else if (sourceType === "wip") {
          const { data: wip } = await svc
            .from("cut_output_batches")
            .select("id, qty_available, qty_consumed")
            .eq("id", sourceId)
            .single();
          if (!wip) return json({ error: "WIP batch not found" }, 404);

          const newAvail = Math.max(0, wip.qty_available - qty);
          const newConsumed = wip.qty_consumed + qty;
          await svc.from("cut_output_batches").update({
            qty_available: newAvail,
            qty_consumed: newConsumed,
            status: newAvail === 0 ? "consumed" : "partial",
          }).eq("id", sourceId);

          events.push({
            entity_type: "inventory",
            entity_id: sourceId,
            event_type: "wip_consumed",
            actor_id: userId,
            actor_type: "user",
            description: `Consumed ${qty}× ${barCode} WIP on bend/spiral start`,
            metadata: { machineRunId, barCode, qty, sourceId },
          });
        }

        // Update reservation status
        if (cutPlanItemId) {
          const { data: reservations } = await svc
            .from("inventory_reservations")
            .select("id, qty_reserved, qty_consumed")
            .eq("source_id", sourceId)
            .eq("cut_plan_item_id", cutPlanItemId)
            .eq("status", "reserved");

          if (reservations?.length) {
            const res = reservations[0];
            const newConsumed = Math.min(res.qty_reserved, res.qty_consumed + qty);
            await svc.from("inventory_reservations").update({
              qty_consumed: newConsumed,
              status: newConsumed >= res.qty_reserved ? "consumed" : "partial",
            }).eq("id", res.id);
          }
        }
        break;
      }

      // ─── CUT COMPLETION: remnant or scrap ──────────────────────────
      case "cut-complete": {
        const { machineRunId, barCode, stockLengthMm, cutLengthMm, piecesPerBar, bars } = body;
        if (!machineRunId || !barCode || !cutLengthMm) {
          return json({ error: "Missing: machineRunId, barCode, cutLengthMm" }, 400);
        }

        const stockLen = stockLengthMm || DEFAULT_STOCK_LENGTH_MM;
        const ppb = piecesPerBar || 1;
        const numBars = bars || 1;

        // Calculate leftover per bar
        const usedPerBar = ppb * cutLengthMm;
        const leftoverPerBar = stockLen - usedPerBar;

        // Create WIP output batch
        const totalPiecesProduced = ppb * numBars;
        const { data: batch, error: batchErr } = await svc
          .from("cut_output_batches")
          .insert({
            company_id: companyId,
            machine_run_id: machineRunId,
            bar_code: barCode,
            cut_length_mm: cutLengthMm,
            qty_produced: totalPiecesProduced,
            qty_available: totalPiecesProduced,
            status: "available",
          })
          .select()
          .single();
        if (batchErr) throw batchErr;

        // Handle leftovers per bar
        for (let b = 0; b < numBars; b++) {
          if (leftoverPerBar >= REMNANT_THRESHOLD_MM) {
            // Create remnant lot
            const { error: remErr } = await svc
              .from("inventory_lots")
              .insert({
                company_id: companyId,
                bar_code: barCode,
                source: "remnant",
                standard_length_mm: leftoverPerBar,
                qty_on_hand: 1,
                location: "floor",
              });
            if (remErr) console.error("Remnant insert error:", remErr);

            events.push({
              entity_type: "inventory",
              entity_id: batch.id,
              event_type: "inventory_remnant_added",
              actor_id: userId,
              actor_type: "user",
              description: `Remnant created: ${leftoverPerBar}mm ${barCode} from cut`,
              metadata: { machineRunId, barCode, leftoverMm: leftoverPerBar, stockLengthMm: stockLen },
            });
          } else if (leftoverPerBar > 0) {
            // Record scrap
            const { error: scrapErr } = await svc
              .from("inventory_scrap")
              .insert({
                company_id: companyId,
                machine_run_id: machineRunId,
                bar_code: barCode,
                length_mm: leftoverPerBar,
                qty: 1,
                reason: "cutoff_below_threshold",
              });
            if (scrapErr) console.error("Scrap insert error:", scrapErr);

            events.push({
              entity_type: "inventory",
              entity_id: batch.id,
              event_type: "inventory_scrap_recorded",
              actor_id: userId,
              actor_type: "user",
              description: `Scrap recorded: ${leftoverPerBar}mm ${barCode} (below ${REMNANT_THRESHOLD_MM}mm threshold)`,
              metadata: { machineRunId, barCode, leftoverMm: leftoverPerBar, threshold: REMNANT_THRESHOLD_MM },
            });
          }
        }
        break;
      }

      // ─── RELEASE RESERVATIONS (for replan) ─────────────────────────
      case "release": {
        const { cutPlanId, cutPlanItemId } = body;
        if (!cutPlanId) return json({ error: "Missing cutPlanId" }, 400);

        // Find all active reservations for this plan/item
        let query = svc
          .from("inventory_reservations")
          .select("*")
          .eq("cut_plan_id", cutPlanId)
          .in("status", ["reserved", "partial"]);

        if (cutPlanItemId) {
          query = query.eq("cut_plan_item_id", cutPlanItemId);
        }

        const { data: reservations } = await query;
        if (!reservations?.length) break;

        for (const res of reservations) {
          const unreserveQty = res.qty_reserved - res.qty_consumed;
          if (unreserveQty <= 0) continue;

          // Return reserved qty to source
          if (res.source_type === "lot" || res.source_type === "remnant") {
            const { data: lot } = await svc
              .from("inventory_lots")
              .select("id, qty_reserved")
              .eq("id", res.source_id)
              .single();
            if (lot) {
              await svc.from("inventory_lots").update({
                qty_reserved: Math.max(0, lot.qty_reserved - unreserveQty),
              }).eq("id", res.source_id);
            }
          } else if (res.source_type === "floor") {
            const { data: fs } = await svc
              .from("floor_stock")
              .select("id, qty_reserved")
              .eq("id", res.source_id)
              .single();
            if (fs) {
              await svc.from("floor_stock").update({
                qty_reserved: Math.max(0, fs.qty_reserved - unreserveQty),
              }).eq("id", res.source_id);
            }
          }

          // Mark reservation as released
          await svc.from("inventory_reservations").update({ status: "released" }).eq("id", res.id);
        }

        events.push({
          entity_type: "inventory",
          entity_id: cutPlanId,
          event_type: "reservation_reallocated",
          actor_id: userId,
          actor_type: "user",
          description: `Released ${reservations.length} reservation(s) for plan recomputation`,
          metadata: { cutPlanId, cutPlanItemId, releasedCount: reservations.length },
        });
        break;
      }

      // ─── REPLAN ────────────────────────────────────────────────────
      case "replan": {
        const { cutPlanId, reason } = body;
        if (!cutPlanId) return json({ error: "Missing cutPlanId" }, 400);

        events.push({
          entity_type: "cut_plan",
          entity_id: cutPlanId,
          event_type: "plan_recomputed",
          actor_id: userId,
          actor_type: "user",
          description: `Plan recomputed: ${reason || "operator change"}`,
          metadata: { cutPlanId, reason },
        });

        // The actual release+re-reserve is done by calling release then reserve again
        // This event just marks the replan intent
        break;
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    // Write events
    if (events.length > 0) {
      const { error: evtErr } = await svc.from("events").insert(events);
      if (evtErr) console.error("Failed to log inventory events:", evtErr);
    }

    return json({ success: true, action });
  } catch (error) {
    console.error("manage-inventory error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
