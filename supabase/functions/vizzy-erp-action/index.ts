import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claims.claims.sub as string;

    // Only allow admin role
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    const { action, params } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: corsHeaders });
    }

    let result: any;

    switch (action) {
      case "update_cut_plan_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("cut_plans").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Cut plan updated to ${status}`, data };
        break;
      }

      case "update_lead_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("leads").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Lead status updated to ${status}`, data };
        break;
      }

      case "update_machine_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("machines").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Machine status changed to ${status}`, data };
        break;
      }

      case "create_event": {
        const { entity_type, entity_id, event_type, description } = params;
        const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
      const { data, error } = await supabaseAdmin.from("activity_events").insert({
          company_id: profile?.company_id,
          entity_type,
          entity_id: entity_id || crypto.randomUUID(),
          event_type,
          description,
          actor_id: userId,
          actor_type: "vizzy",
          source: "system",
        }).select().single();
        if (error) throw error;
        result = { success: true, message: `Event logged: ${event_type}`, data };
        break;
      }

      case "update_delivery_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("deliveries").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Delivery status updated to ${status}`, data };
        break;
      }

      case "update_cut_plan_item": {
        const { id, updates } = params;
        const safeUpdates: any = {};
        if (updates.phase) safeUpdates.phase = updates.phase;
        if (updates.completed_pieces !== undefined) safeUpdates.completed_pieces = updates.completed_pieces;
        if (updates.notes) safeUpdates.notes = updates.notes;
        if (updates.needs_fix !== undefined) safeUpdates.needs_fix = updates.needs_fix;
        const { data, error } = await supabaseAdmin.from("cut_plan_items").update(safeUpdates).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Cut plan item updated`, data };
        break;
      }

      case "log_fix_request": {
        const { description, affected_area, photo_url } = params;
        const { data, error } = await supabaseAdmin.from("vizzy_fix_requests").insert({
          user_id: userId,
          description,
          affected_area: affected_area || null,
          photo_url: photo_url || null,
        }).select().single();
        if (error) throw error;
        result = { success: true, message: `Fix request logged: ${description.slice(0, 60)}`, data };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }

    // Log the action as an event
    const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
    await supabaseAdmin.from("activity_events").insert({
      company_id: profile?.company_id,
      entity_type: "vizzy_action",
      entity_id: params?.id || crypto.randomUUID(),
      event_type: `vizzy_${action}`,
      description: `Vizzy executed: ${action}`,
      actor_id: userId,
      actor_type: "vizzy",
      metadata: { params },
      source: "system",
      dedupe_key: `vizzy_action:${action}:${params?.id || ""}:${new Date().toISOString().slice(0, 13)}`,
    }).catch(() => {});

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-erp-action error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
