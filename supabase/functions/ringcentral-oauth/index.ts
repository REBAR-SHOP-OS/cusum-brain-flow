import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;

  return data.claims.sub as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // empty body
    }

    const action = body.action as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");

    // ─── Generate OAuth URL ────────────────────────────────────────
    if (action === "get-auth-url") {
      const redirectUri = body.redirectUri as string;

      if (!clientId) throw new Error("RingCentral Client ID not configured");

      // Get user's email for login hint
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email || "";

      const authUrl = new URL(`${RC_SERVER}/restapi/oauth/authorize`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", "ringcentral");
      if (userEmail) authUrl.searchParams.set("login_hint", userEmail);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Exchange code for tokens ──────────────────────────────────
    if (action === "exchange-code") {
      const code = body.code as string;
      const redirectUri = body.redirectUri as string;

      if (!clientId || !clientSecret) {
        throw new Error("RingCentral OAuth credentials not configured");
      }

      const credentials = btoa(`${clientId}:${clientSecret}`);

      const tokenResponse = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`RingCentral token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();

      if (!tokens.refresh_token) {
        throw new Error("No refresh token received from RingCentral.");
      }

      // Get user's RC email/extension info
      let rcEmail = "";
      try {
        const extRes = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (extRes.ok) {
          const extData = await extRes.json();
          rcEmail = extData.contact?.email || extData.name || "";
        }
      } catch {
        // continue without email
      }

      // Save tokens per-user
      const { error: upsertError } = await supabaseAdmin
        .from("user_ringcentral_tokens")
        .upsert({
          user_id: userId,
          rc_email: rcEmail,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to save RC token:", upsertError);
        throw new Error("Failed to save RingCentral credentials");
      }

      return new Response(
        JSON.stringify({
          success: true,
          rcEmail,
          message: `RingCentral connected as ${rcEmail || "your account"}!`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check connection status for current user ──────────────────
    if (action === "check-status") {
      const { data: tokenData } = await supabaseAdmin
        .from("user_ringcentral_tokens")
        .select("rc_email, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (tokenData) {
        return new Response(
          JSON.stringify({ status: "connected", email: tokenData.rc_email }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: check if shared JWT credentials exist and match this user
      const jwt = Deno.env.get("RINGCENTRAL_JWT");
      const jwtClientId = Deno.env.get("RINGCENTRAL_JWT_CLIENT_ID");
      const jwtClientSecret = Deno.env.get("RINGCENTRAL_JWT_CLIENT_SECRET");

      if (jwt && jwtClientId && jwtClientSecret) {
        try {
          const credentials = btoa(`${jwtClientId}:${jwtClientSecret}`);
          const tokenRes = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion: jwt,
            }),
          });

          if (tokenRes.ok) {
            const tokenData2 = await tokenRes.json();
            const extRes = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~`, {
              headers: { Authorization: `Bearer ${tokenData2.access_token}` },
            });
            if (extRes.ok) {
              const extData = await extRes.json();
              const rcEmail = (extData.contact?.email || "").toLowerCase();

              const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
              const userEmail = userData?.user?.email?.toLowerCase();

              if (rcEmail && userEmail && rcEmail === userEmail) {
                // Auto-migrate: save the JWT-derived token for this user
                await supabaseAdmin.from("user_ringcentral_tokens").upsert({
                  user_id: userId,
                  rc_email: rcEmail,
                  refresh_token: `jwt:${jwt}`,
                  access_token: tokenData2.access_token,
                  token_expires_at: new Date(Date.now() + (tokenData2.expires_in || 3600) * 1000).toISOString(),
                }, { onConflict: "user_id" });

                return new Response(
                  JSON.stringify({ status: "connected", email: rcEmail }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          }
        } catch {
          // Shared JWT check failed
        }
      }

      return new Response(
        JSON.stringify({ status: "not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect RingCentral for current user ──────────────────
    if (action === "disconnect") {
      await supabaseAdmin
        .from("user_ringcentral_tokens")
        .delete()
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
