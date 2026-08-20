import { handleRequest } from "../_shared/requestHandler.ts";
import { constantTimeEqual } from "../_shared/qbHttp.ts";
import { corsHeaders } from "../_shared/auth.ts";

/** Verify HMAC-SHA256 signature from QuickBooks using constant-time comparison */
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return constantTimeEqual(computed, signature);
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: svc, req: rawReq }) => {
    const verifierToken = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN");

    // QB webhook sends GET for validation
    if (rawReq.method === "GET") {
      if (!verifierToken) {
        return new Response("Webhook verifier not configured", { status: 500 });
      }
      return new Response(verifierToken, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // --- HMAC signature verification on POST ---
    const rawBody = await rawReq.text();
    const intuitSignature = rawReq.headers.get("intuit-signature");

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

        try {
          const { data: inserted } = await svc
            .from("qb_webhook_events")
            .insert({
              company_id: companyId,
              realm_id: realmId,
              entity_type: entityType,
              entity_id: entityId,
              operation: operation,
              raw_payload: entity,
            })
            .select("id")
            .maybeSingle();

          if (!inserted) {
            console.log(`[qb-webhook] Duplicate event skipped: ${entityType}/${entityId}/${operation}`);
            continue;
          }
        } catch (e) {
          const msg = String(e);
          if (msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("idx_qb_webhook_events_dedupe")) {
            console.log(`[qb-webhook] Duplicate event (constraint): ${entityType}/${entityId}/${operation}`);
            continue;
          }
          console.error("[qb-webhook] Failed to log event:", e);
          continue;
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

    return { ok: true };
  }, { functionName: "qb-webhook", authMode: "none", requireCompany: false, parseBody: false, wrapResult: false })
);
