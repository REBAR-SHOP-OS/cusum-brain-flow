import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Pipeline Webhooks — fires outbound webhook notifications on pipeline events.
 * 
 * POST /pipeline-webhooks
 *   body: { event_type, lead, old_stage?, new_stage?, metadata? }
 * 
 * GET /pipeline-webhooks?action=list
 *   Lists configured webhook endpoints for the company.
 * 
 * POST /pipeline-webhooks (action: "register")
 *   Register a new webhook endpoint: { action: "register", url, events[], secret? }
 * 
 * POST /pipeline-webhooks (action: "delete")
 *   Delete a webhook: { action: "delete", webhook_id }
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: service, companyId, body, req: originalReq } = ctx;

    // GET — list webhooks
    if (req.method === "GET") {
      const { data: webhooks } = await service
        .from("pipeline_webhooks")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ webhooks: webhooks || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST
    const body = await req.json();

    // Register webhook
    if (body.action === "register") {
      const { url, events, secret, name } = body;
      if (!url || !events?.length) {
        return new Response(JSON.stringify({ error: "url and events required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: wh, error: insErr } = await service
        .from("pipeline_webhooks")
        .insert({
          company_id: companyId,
          url,
          events,
          secret: secret || null,
          name: name || url,
          enabled: true,
          created_by: userId,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      return new Response(JSON.stringify({ webhook: wh }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete webhook
    if (body.action === "delete") {
      await service.from("pipeline_webhooks").delete().eq("id", body.webhook_id).eq("company_id", companyId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle webhook
    if (body.action === "toggle") {
      const { data: existing } = await service
        .from("pipeline_webhooks")
        .select("enabled")
        .eq("id", body.webhook_id)
        .eq("company_id", companyId)
        .single();
      if (existing) {
        await service.from("pipeline_webhooks").update({ enabled: !existing.enabled }).eq("id", body.webhook_id);
      }
      return new Response(JSON.stringify({ success: true, enabled: !existing?.enabled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire webhook event (called by automation engine or triggers)
    if (body.event_type) {
      const { data: webhooks } = await service
        .from("pipeline_webhooks")
        .select("*")
        .eq("company_id", companyId)
        .eq("enabled", true);

      const matching = (webhooks || []).filter((wh: any) =>
        wh.events.includes(body.event_type) || wh.events.includes("*")
      );

      const payload = {
        event: body.event_type,
        timestamp: new Date().toISOString(),
        lead: body.lead || null,
        old_stage: body.old_stage || null,
        new_stage: body.new_stage || null,
        metadata: body.metadata || {},
      };

      const deliveries = await Promise.allSettled(
        matching.map(async (wh: any) => {
          const hdrs: Record<string, string> = { "Content-Type": "application/json" };
          if (wh.secret) {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey("raw", encoder.encode(wh.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
            hdrs["X-Webhook-Signature"] = btoa(String.fromCharCode(...new Uint8Array(sig)));
          }

          // R16-4: Attempt delivery with single retry on failure
          let res: Response | null = null;
          let lastError: string | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              res = await fetch(wh.url, {
                method: "POST",
                headers: hdrs,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000),
              });
              if (res.ok) break;
              lastError = `HTTP ${res.status}`;
            } catch (e) {
              lastError = String(e);
              res = null;
            }
            // Wait 3s before retry
            if (attempt === 0) await new Promise(r => setTimeout(r, 3000));
          }

          const status = res?.status ?? 0;
          const ok = res?.ok ?? false;

          // Log delivery
          try {
            await service.from("pipeline_webhook_deliveries").insert({
              webhook_id: wh.id,
              company_id: companyId,
              event_type: body.event_type,
              payload,
              response_status: status,
              success: ok,
            });
          } catch (e) { console.warn("Failed to log delivery:", e); }

          if (!ok) console.warn(`Webhook delivery failed for ${wh.id}: ${lastError}`);
          return { webhook_id: wh.id, status, ok };
        })
      );

      return new Response(JSON.stringify({
        delivered: deliveries.filter(d => d.status === "fulfilled").length,
        failed: deliveries.filter(d => d.status === "rejected").length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "pipeline-webhooks", wrapResult: false })
);
