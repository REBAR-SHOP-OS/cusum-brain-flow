import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RC_SERVER = "https://platform.ringcentral.com";
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"];

async function getAccessToken(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow?.refresh_token) return null;

  if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) > new Date()) {
    return tokenRow.access_token;
  }

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

/** Fetch the user's phone numbers from RingCentral extension */
async function getUserPhoneNumbers(accessToken: string): Promise<{ callerId: string; smsSender: string }> {
  let callerId = "";
  let smsSender = "";
  try {
    const resp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const records = data.records || [];
      const directNum = records.find(
        (r: any) => r.usageType === "DirectNumber" && r.features?.includes("CallerId")
      );
      callerId = directNum?.phoneNumber || records[0]?.phoneNumber || "";
      const smsNum = records.find(
        (r: any) => r.features?.includes("SmsSender")
      );
      smsSender = smsNum?.phoneNumber || callerId;
      console.log("RC phone numbers found:", { callerId, smsSender, totalRecords: records.length });
    } else {
      console.warn("Failed to fetch RC phone numbers:", resp.status);
    }
  } catch (e) {
    console.error("Error fetching RC phone numbers:", e);
  }
  return { callerId, smsSender };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!SUPER_ADMIN_EMAILS.includes(profile?.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, phone, message, contact_name } = await req.json();

    const accessToken = await getAccessToken(supabaseAdmin, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "RingCentral not connected. Please reconnect your account in Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's actual phone numbers for from field
    const { callerId, smsSender } = await getUserPhoneNumbers(accessToken);

    if (type === "ringcentral_call") {
      console.log("RingOut request:", { from: callerId, to: phone, userId, contact_name });
      const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/ring-out`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { phoneNumber: callerId },
          to: { phoneNumber: phone },
          playPrompt: true,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error("RingOut failed:", data);
        return new Response(JSON.stringify({ error: "Failed to initiate call", details: data }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "call", phone, contact_name, ringout_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "ringcentral_sms") {
      console.log("SMS request:", { from: smsSender, to: phone, userId, contact_name, messageLength: message?.length });
      const resp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { phoneNumber: smsSender },
          to: [{ phoneNumber: phone }],
          text: message,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error("SMS failed:", data);
        return new Response(JSON.stringify({ error: "Failed to send SMS", details: data }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "sms", phone, contact_name, message_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Unknown action type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error("ringcentral-action error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
