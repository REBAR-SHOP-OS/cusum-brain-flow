import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"];

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
      .select("email, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!SUPER_ADMIN_EMAILS.includes(profile?.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get any RC token for this company to query active calls
    const { data: companyProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("company_id", profile!.company_id);

    const userIds = (companyProfiles || []).map((p) => p.user_id);
    const { data: tokenRow } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("access_token, token_expires_at, refresh_token, user_id")
      .in("user_id", userIds)
      .order("token_expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ activeCalls: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ activeCalls: [], error: "Token refresh failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tokens = await resp.json();
      accessToken = tokens.access_token;
      await supabaseAdmin.from("user_ringcentral_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      }).eq("user_id", tokenRow.user_id);
    }

    // Fetch active calls
    const resp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/active-calls?view=Detailed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Active calls fetch failed:", errText);
      return new Response(JSON.stringify({ activeCalls: [], error: "Failed to fetch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ activeCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ringcentral-active-calls error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
