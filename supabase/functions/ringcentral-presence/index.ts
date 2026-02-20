import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";

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

    // Get company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users in company who have RC tokens
    const { data: companyProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("company_id", companyId);

    if (!companyProfiles?.length) {
      return new Response(JSON.stringify({ presenceData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = companyProfiles.map((p) => p.user_id);

    const { data: tokenRows } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("user_id, access_token, token_expires_at, refresh_token")
      .in("user_id", userIds);

    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ presenceData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

        // Upsert to rc_presence table
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

    return new Response(JSON.stringify({ presenceData: presenceResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ringcentral-presence error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
