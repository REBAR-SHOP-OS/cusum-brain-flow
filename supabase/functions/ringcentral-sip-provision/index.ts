import { handleRequest } from "../_shared/requestHandler.ts";
import { SUPER_ADMIN_EMAILS } from "../_shared/accessPolicies.ts";
import { corsHeaders } from "../_shared/auth.ts";

const RC_SERVER = "https://platform.ringcentral.com";

async function refreshToken(supabaseAdmin: any, userId: string, refreshTokenValue: string): Promise<string | null> {
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
      refresh_token: refreshTokenValue,
    }),
  });

  if (!resp.ok) {
    console.error("RC token refresh failed:", await resp.text());
    await supabaseAdmin.from("user_ringcentral_tokens").delete().eq("user_id", userId);
    return null;
  }

  const tokens = await resp.json();
  await supabaseAdmin.from("user_ringcentral_tokens").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId);

  return tokens.access_token;
}

async function getAccessToken(supabaseAdmin: any, userId: string, forceRefresh = false): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow?.refresh_token) return null;

  if (!forceRefresh && tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) > new Date()) {
    return tokenRow.access_token;
  }

  return await refreshToken(supabaseAdmin, userId, tokenRow.refresh_token);
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: supabaseAdmin, body }) => {
    // Super admin check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!SUPER_ADMIN_EMAILS.includes(profile?.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = await getAccessToken(supabaseAdmin, userId);
    if (!accessToken) {
      return { error: "RingCentral not connected", connected: false };
    }

    console.log("Requesting SIP provision for user:", userId);

    const doSipProvision = async (token: string) => {
      return await fetch(`${RC_SERVER}/restapi/v1.0/client-info/sip-provision`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sipInfo: [{ transport: "WSS" }] }),
      });
    };

    let sipResp = await doSipProvision(accessToken);

    // If 401, force-refresh the token and retry once
    if (sipResp.status === 401) {
      console.warn("SIP provision returned 401, forcing token refresh and retrying...");
      await sipResp.text();
      accessToken = await getAccessToken(supabaseAdmin, userId, true);
      if (!accessToken) {
        return { error: "RingCentral token expired. Please reconnect.", connected: false };
      }
      sipResp = await doSipProvision(accessToken);
    }

    if (!sipResp.ok) {
      const errText = await sipResp.text();
      console.error("SIP provision failed:", sipResp.status, errText);
      return new Response(JSON.stringify({ error: "SIP provisioning failed", details: errText }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sipData = await sipResp.json();
    const sipInfo = sipData.sipInfo?.[0];
    if (!sipInfo) {
      return new Response(JSON.stringify({ error: "No SIP info returned" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also get caller ID numbers
    let callerIds: string[] = [];
    try {
      const phoneResp = await fetch(
        `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (phoneResp.ok) {
        const phoneData = await phoneResp.json();
        callerIds = (phoneData.records || [])
          .filter((r: any) => r.features?.includes("CallerId"))
          .map((r: any) => r.phoneNumber);
      }
    } catch (e) {
      console.warn("Failed to fetch caller IDs:", e);
    }

    console.log("SIP provision success, callerIds:", callerIds);

    return { sipInfo, callerIds };
  }, { functionName: "ringcentral-sip-provision", requireCompany: false, wrapResult: false })
);
