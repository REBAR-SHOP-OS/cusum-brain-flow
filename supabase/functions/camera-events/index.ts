import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-camera-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // API-key auth for external FastAPI caller
  const apiKey = req.headers.get("x-camera-api-key");
  const expectedKey = Deno.env.get("CAMERA_API_KEY");
  if (!expectedKey || apiKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.company_id || !body.event_type) {
      return json({ error: "company_id and event_type are required" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const row = {
      company_id: body.company_id,
      event_type: body.event_type,
      camera_id: body.camera_id ?? null,
      zone: body.zone ?? null,
      detected_class: body.detected_class ?? null,
      confidence: body.confidence ?? null,
      related_machine_id: body.related_machine_id ?? null,
      related_order_id: body.related_order_id ?? null,
      related_delivery_id: body.related_delivery_id ?? null,
      snapshot_url: body.snapshot_url ?? null,
      recommended_action: body.recommended_action ?? null,
      metadata: body.metadata ?? {},
    };

    const { data, error } = await sb
      .from("camera_events")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return json({ error: error.message }, 500);
    }

    return json({ id: data.id, status: "ok" });
  } catch (err) {
    console.error("camera-events error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
