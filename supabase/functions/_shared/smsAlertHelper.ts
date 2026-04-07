/**
 * SMS Alert Helper — Send SMS notifications to the CEO via RingCentral
 * 
 * Reusable across edge functions. Never throws — returns success/failure silently
 * so alerts don't break primary flows.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RC_SERVER = "https://platform.ringcentral.com";
const CEO_PHONE = "+14165870788";

export async function sendCeoSmsAlert(message: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get ANY RC token (use first available — typically the admin user)
    const { data: tokenRows } = await supabase
      .from("user_ringcentral_tokens")
      .select("user_id, access_token, refresh_token, token_expires_at")
      .limit(5);

    if (!tokenRows || tokenRows.length === 0) {
      console.warn("[smsAlert] No RC tokens available — cannot send SMS alert");
      return false;
    }

    let accessToken: string | null = null;

    for (const row of tokenRows) {
      if (!row.refresh_token) continue;

      // Check if token is still valid
      if (row.token_expires_at && new Date(row.token_expires_at) > new Date()) {
        accessToken = row.access_token;
        break;
      }

      // Try refresh
      const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
      const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
      if (!clientId || !clientSecret) continue;

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
      await supabase.from("user_ringcentral_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("user_id", row.user_id);

      accessToken = tokens.access_token;
      break;
    }

    if (!accessToken) {
      console.warn("[smsAlert] Could not obtain valid RC access token");
      return false;
    }

    // Find SMS-capable number
    const phoneResp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let smsSender = "";
    if (phoneResp.ok) {
      const data = await phoneResp.json();
      const records = data.records || [];
      const smsNum = records.find((r: any) => r.features?.includes("SmsSender"));
      smsSender = smsNum?.phoneNumber || records[0]?.phoneNumber || "";
    }

    if (!smsSender) {
      console.warn("[smsAlert] No SMS-capable number found");
      return false;
    }

    // Send SMS
    const smsResp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { phoneNumber: smsSender },
        to: [{ phoneNumber: CEO_PHONE }],
        text: message.slice(0, 500),
      }),
    });

    if (!smsResp.ok) {
      const err = await smsResp.text();
      console.error("[smsAlert] SMS send failed:", smsResp.status, err);
      return false;
    }

    console.log(`[smsAlert] SMS sent to CEO: ${message.slice(0, 80)}...`);
    return true;
  } catch (e) {
    console.error("[smsAlert] Unexpected error:", e);
    return false;
  }
}
