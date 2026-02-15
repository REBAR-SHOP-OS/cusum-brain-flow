import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const accessToken = await getAccessToken(supabaseAdmin, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "RingCentral not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call SIP provisioning endpoint
    console.log("Requesting SIP provision for user:", userId);
    const sipResp = await fetch(`${RC_SERVER}/restapi/v1.0/client-info/sip-provision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sipInfo: [{ transport: "WSS" }],
      }),
    });

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

    return new Response(JSON.stringify({ sipInfo, callerIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("ringcentral-sip-provision error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
