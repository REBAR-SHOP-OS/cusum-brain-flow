import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const RC_SERVER = "https://platform.ringcentral.com";

/**
 * Registers a RingCentral webhook subscription so inbound calls/SMS/voicemail
 * are pushed in real-time instead of relying solely on the 15-min cron poll.
 *
 * POST body (optional):
 *   { "renew": true }   — list existing subs and renew/create as needed
 *   { "delete": "sub-id" } — remove a specific subscription
 *
 * Requires: RINGCENTRAL_WEBHOOK_SECRET env var for the callback token.
 */
Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabaseAdmin, body, log } = ctx;

    const webhookSecret = Deno.env.get("RINGCENTRAL_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: "RINGCENTRAL_WEBHOOK_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get admin RC token (same pattern as ringcentral-sync cron)
    const { data: tokenRows } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("user_id, access_token, refresh_token, token_expires_at")
      .order("token_expires_at", { ascending: false })
      .limit(5);

    if (!tokenRows?.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No RingCentral tokens found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let accessToken: string | null = null;

    for (const row of tokenRows) {
      // If token is still valid, use it
      if (row.token_expires_at && new Date(row.token_expires_at) > new Date()) {
        accessToken = row.access_token;
        break;
      }

      // Try refresh
      if (row.refresh_token) {
        const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
        const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;

        const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: row.refresh_token,
          }),
        });

        if (resp.ok) {
          const tokens = await resp.json();
          await supabaseAdmin.from("user_ringcentral_tokens").update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          }).eq("user_id", row.user_id);
          accessToken = tokens.access_token;
          break;
        } else {
          const errText = await resp.text();
          log.warn("Token refresh failed", { userId: row.user_id, error: errText });
        }
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "Could not obtain a working RC access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Handle delete request
    if (body.delete) {
      const delResp = await fetch(
        `${RC_SERVER}/restapi/v1.0/subscription/${body.delete}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const delText = await delResp.text();
      log.info("Deleted subscription", { id: body.delete, status: delResp.status });
      return { deleted: body.delete, status: delResp.status, response: delText };
    }

    // List existing subscriptions to avoid duplicates
    const listResp = await fetch(
      `${RC_SERVER}/restapi/v1.0/subscription`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = await listResp.json();
    const existing = (listData.records || []) as any[];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/ringcentral-webhook?token=${webhookSecret}`;

    // Check if we already have an active subscription pointing to our webhook
    const activeSub = existing.find(
      (s: any) => s.status === "Active" && s.deliveryMode?.address?.includes("ringcentral-webhook"),
    );

    if (activeSub && !body.renew) {
      log.info("Active subscription already exists", {
        id: activeSub.id,
        expiresAt: activeSub.expirationTime,
        eventFilters: activeSub.eventFilters?.length,
      });
      return {
        action: "already_active",
        subscription_id: activeSub.id,
        expires_at: activeSub.expirationTime,
        event_filters: activeSub.eventFilters,
      };
    }

    // If renewing, try to update existing sub first
    if (activeSub && body.renew) {
      const renewResp = await fetch(
        `${RC_SERVER}/restapi/v1.0/subscription/${activeSub.id}/renew`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (renewResp.ok) {
        const renewed = await renewResp.json();
        log.info("Renewed existing subscription", { id: renewed.id, expiresAt: renewed.expirationTime });
        return {
          action: "renewed",
          subscription_id: renewed.id,
          expires_at: renewed.expirationTime,
        };
      }
      // If renew failed, fall through to create new
      const renewErr = await renewResp.text();
      log.warn("Renew failed, creating new", { error: renewErr });
    }

    // Create new subscription
    const eventFilters = [
      "/restapi/v1.0/account/~/extension/~/telephony/sessions",
      "/restapi/v1.0/account/~/extension/~/message-store",
    ];

    const createResp = await fetch(`${RC_SERVER}/restapi/v1.0/subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventFilters,
        deliveryMode: {
          transportType: "WebHook",
          address: callbackUrl,
        },
        expiresIn: 630720000, // ~20 years (RC will cap to max allowed)
      }),
    });

    const createData = await createResp.json();

    if (!createResp.ok) {
      log.error("Failed to create subscription", { status: createResp.status, error: createData });
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to create RC subscription", details: createData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log.info("Created webhook subscription", {
      id: createData.id,
      expiresAt: createData.expirationTime,
      eventFilters: createData.eventFilters?.length,
    });

    return {
      action: "created",
      subscription_id: createData.id,
      expires_at: createData.expirationTime,
      event_filters: createData.eventFilters,
      callback_url: callbackUrl,
    };
  }, {
    functionName: "ringcentral-register-webhook",
    requireCompany: false,
    wrapResult: true,
  }),
);
