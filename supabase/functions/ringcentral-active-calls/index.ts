import { handleRequest } from "../_shared/requestHandler.ts";
import { SUPER_ADMIN_EMAILS } from "../_shared/accessPolicies.ts";

const RC_SERVER = "https://platform.ringcentral.com";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin } = ctx;

    // Super admin check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || !SUPER_ADMIN_EMAILS.includes(profile.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin only" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!profile.company_id) {
      return { activeCalls: [], error: "No company" };
    }

    const { data: companyProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("company_id", profile.company_id);

    const userIds = (companyProfiles || []).map((p: any) => p.user_id);
    const { data: tokenRow } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("access_token, token_expires_at, refresh_token, user_id")
      .in("user_id", userIds)
      .order("token_expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow) {
      return { activeCalls: [] };
    }

    let accessToken = tokenRow.access_token;

    // Refresh if needed
    if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) <= new Date()) {
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
          refresh_token: tokenRow.refresh_token,
        }),
      });
      if (!resp.ok) {
        return { activeCalls: [], error: "Token refresh failed" };
      }
      const tokens = await resp.json();
      accessToken = tokens.access_token;
      await supabaseAdmin.from("user_ringcentral_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      }).eq("user_id", tokenRow.user_id);
    }

    const resp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/active-calls?view=Detailed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Active calls fetch failed:", errText);
      return { activeCalls: [], error: "Failed to fetch" };
    }

    const data = await resp.json();
    const activeCalls = (data.records || []).map((call: any) => ({
      id: call.id,
      sessionId: call.sessionId,
      direction: call.direction,
      from: call.from?.phoneNumber || call.from?.name || "Unknown",
      to: call.to?.phoneNumber || call.to?.name || "Unknown",
      status: call.telephonyStatus || call.result || "Active",
      startTime: call.startTime,
      duration: call.duration || 0,
    }));

    return { activeCalls };
  }, { functionName: "ringcentral-active-calls", requireCompany: false, wrapResult: false })
);
