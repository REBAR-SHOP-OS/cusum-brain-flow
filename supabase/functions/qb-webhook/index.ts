import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // QB webhook sends GET for validation, POST for events
    if (req.method === "GET") {
      // Intuit verification: respond with verifier token
      const verifierToken = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN");
      if (!verifierToken) {
        return new Response("Webhook verifier not configured", { status: 500 });
      }
      return new Response(verifierToken, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const payload = await req.json();
    console.log("[qb-webhook] Received:", JSON.stringify(payload).slice(0, 500));

    // QB sends eventNotifications array
    const notifications = payload.eventNotifications || [];

    for (const notification of notifications) {
      const realmId = notification.realmId;
      const events = notification.dataChangeEvent?.entities || [];

      // Find company_id by realm_id
      const { data: conn } = await svc
        .from("integration_connections")
        .select("config")
        .eq("integration_id", "quickbooks")
        .eq("status", "connected");

      let companyId: string | null = null;
      if (conn) {
        for (const c of conn) {
          const cfg = c.config as Record<string, unknown>;
          if (cfg?.realm_id === realmId) {
            companyId = (cfg.company_id as string) || null;
            break;
          }
        }
      }

      for (const entity of events) {
        const entityType = entity.name;
        const entityId = entity.id;
        const operation = entity.operation;

        // Log the event
        try {
          await svc.from("qb_webhook_events").insert({
            company_id: companyId,
            realm_id: realmId,
            entity_type: entityType,
            entity_id: entityId,
            operation: operation,
            raw_payload: entity,
          });
        } catch (e) {
          console.error("[qb-webhook] Failed to log event:", e);
        }

        // Trigger incremental sync for this company
        if (companyId) {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            await fetch(`${supabaseUrl}/functions/v1/qb-sync-engine`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${svcKey}`,
              },
              body: JSON.stringify({
                action: "incremental",
                company_id: companyId,
              }),
            });

            // Mark as processed
            await svc
              .from("qb_webhook_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("realm_id", realmId)
              .eq("entity_id", entityId)
              .eq("entity_type", entityType)
              .is("processed_at", null);
          } catch (e) {
            console.error("[qb-webhook] Sync trigger failed:", e);
            await svc
              .from("qb_webhook_events")
              .update({ error_message: String(e) })
              .eq("realm_id", realmId)
              .eq("entity_id", entityId)
              .eq("entity_type", entityType)
              .is("processed_at", null);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[qb-webhook] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
