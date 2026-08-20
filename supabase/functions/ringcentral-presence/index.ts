import { handleRequest } from "../_shared/requestHandler.ts";

const RC_SERVER = "https://platform.ringcentral.com";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, companyId } = ctx;

    // Get all users in company who have RC tokens
    const { data: companyProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("company_id", companyId);

    if (!companyProfiles?.length) {
      return { presenceData: [] };
    }

    const userIds = companyProfiles.map((p: any) => p.user_id);

    const { data: tokenRows } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("user_id, access_token, token_expires_at, refresh_token")
      .in("user_id", userIds);

    if (!tokenRows?.length) {
      return { presenceData: [] };
    }

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    const presenceResults: Array<{
      user_id: string;
      status: string;
      dnd_status: string | null;
      telephony_status: string | null;
      message: string | null;
    }> = [];

    for (const row of tokenRows) {
      let accessToken = row.access_token;

      // Refresh if expired
      if (row.token_expires_at && new Date(row.token_expires_at) <= new Date()) {
        if (!clientId || !clientSecret || !row.refresh_token) continue;
        try {
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
          if (!resp.ok) continue;
          const tokens = await resp.json();
          accessToken = tokens.access_token;
          await supabaseAdmin.from("user_ringcentral_tokens").update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || row.refresh_token,
            token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          }).eq("user_id", row.user_id);
        } catch {
          continue;
        }
      }

      // Fetch presence
      try {
        const resp = await fetch(
          `${RC_SERVER}/restapi/v1.0/account/~/extension/~/presence`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!resp.ok) {
          await resp.text();
          continue;
        }
        const data = await resp.json();
        const entry = {
          user_id: row.user_id,
          status: data.presenceStatus || data.userStatus || "Offline",
          dnd_status: data.dndStatus || null,
          telephony_status: data.telephonyStatus || null,
          message: data.message || null,
        };
        presenceResults.push(entry);

        await supabaseAdmin.from("rc_presence").upsert({
          user_id: row.user_id,
          company_id: companyId,
          status: entry.status,
          dnd_status: entry.dnd_status,
          telephony_status: entry.telephony_status,
          message: entry.message,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch (e) {
        console.error(`Presence fetch failed for ${row.user_id}:`, e);
      }
    }

    return { presenceData: presenceResults };
  }, { functionName: "ringcentral-presence", wrapResult: false })
);
