import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Verify HMAC-SHA256 signature from QuickBooks */
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const verifierToken = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN");

  try {
    // QB webhook sends GET for validation
    if (req.method === "GET") {
      if (!verifierToken) {
        return new Response("Webhook verifier not configured", { status: 500 });
      }
      return new Response(verifierToken, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // --- R16-1: HMAC signature verification on POST ---
    const rawBody = await req.text();
    const intuitSignature = req.headers.get("intuit-signature");

    if (!verifierToken) {
      console.error("[qb-webhook] QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN not set");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!intuitSignature || !(await verifySignature(rawBody, intuitSignature, verifierToken))) {
      console.warn("[qb-webhook] Invalid or missing intuit-signature header");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    console.log("[qb-webhook] Verified payload:", JSON.stringify(payload).slice(0, 500));

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

        // --- R16-2: Replay/dedup protection ---
        try {
          const { data: existing } = await svc
            .from("qb_webhook_events")
            .select("id, created_at")
            .eq("realm_id", realmId)
            .eq("entity_type", entityType)
            .eq("entity_id", entityId)
            .eq("operation", operation)
            .gte("created_at", new Date(Date.now() - 60_000).toISOString())
            .limit(1);

          if (existing && existing.length > 0) {
            console.log(`[qb-webhook] Duplicate event skipped: ${entityType}/${entityId}/${operation}`);
            continue;
          }
        } catch (e) {
          console.warn("[qb-webhook] Dedup check failed, proceeding:", e);
        }

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

            await svc
              .from("qb_webhook_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("realm_id", realmId)
              .eq("entity_id", entityId)
              .eq("entity_type", entityType)
              .is("processed_at", null);
          } catch (e) {
            console.error("[qb-webhook] Sync trigger failed:", e);
            try {
              await svc
                .from("qb_webhook_events")
                .update({ error_message: String(e) })
                .eq("realm_id", realmId)
                .eq("entity_id", entityId)
                .eq("entity_type", entityType)
                .is("processed_at", null);
            } catch (logErr) {
              console.error("[qb-webhook] Failed to log error:", logErr);
            }
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
