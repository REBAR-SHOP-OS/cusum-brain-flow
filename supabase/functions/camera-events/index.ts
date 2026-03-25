import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API-key auth for external FastAPI caller
    const apiKey = req.headers.get("x-camera-api-key");
    const expectedKey = Deno.env.get("CAMERA_API_KEY");
    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.company_id || !body.event_type) {
      return new Response(JSON.stringify({ error: "company_id and event_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data, error } = await serviceClient
      .from("camera_events")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return { id: data.id, status: "ok" };
  }, { functionName: "camera-events", authMode: "none", requireCompany: false, rawResponse: true })
);
