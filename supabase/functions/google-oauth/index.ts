import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCOPES: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  "google-calendar": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  "google-drive": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
  ],
  youtube: [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.upload",
  ],
  "google-analytics": [
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  "google-search-console": [
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
};

// All Google services that get connected together
const GOOGLE_SERVICES = Object.keys(SCOPES);

// Combined scopes for unified Google connect
const ALL_GOOGLE_SCOPES = [...new Set(Object.values(SCOPES).flat())];

function getClientCredentials() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("GMAIL_CLIENT_SECRET");
  return { clientId, clientSecret };
}

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

    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // empty body
    }

    if (!action && body.action) action = body.action as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Generate OAuth URL (unified — requests ALL scopes) ────────
    if (action === "get-auth-url") {
      const redirectUri = body.redirectUri as string;

      const { clientId } = getClientCredentials();
      if (!clientId) throw new Error("Google Client ID not configured");

      // Get user's email to pre-fill the login hint
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email || "";

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", ALL_GOOGLE_SCOPES.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", "google"); // unified state
      if (userEmail) authUrl.searchParams.set("login_hint", userEmail);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Exchange code for tokens (connects ALL Google services) ───
    if (action === "exchange-code") {
      const code = body.code as string;
      const redirectUri = body.redirectUri as string;

      const { clientId, clientSecret } = getClientCredentials();
      if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();

      if (!tokens.refresh_token) {
        throw new Error("No refresh token received. Please revoke app access in your Google Account and try again.");
      }

      // Get the user's Google email
      let googleEmail = "";
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        googleEmail = profile.emailAddress || "";
      }

      // Save refresh token per-user
      const { error: upsertError } = await supabaseAdmin
        .from("user_gmail_tokens")
        .upsert({
          user_id: userId,
          gmail_email: googleEmail,
          refresh_token: tokens.refresh_token,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to save Google token:", upsertError);
        throw new Error("Failed to save Google credentials");
      }

      // Mark ALL Google services as connected for this user
      for (const svc of GOOGLE_SERVICES) {
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            user_id: userId,
            integration_id: svc,
            status: "connected",
            last_checked_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            error_message: null,
            config: { google_email: googleEmail },
          }, { onConflict: "user_id,integration_id" });
      }

      return new Response(
        JSON.stringify({
          success: true,
          googleEmail,
          connectedServices: GOOGLE_SERVICES,
          message: `Google account connected as ${googleEmail}! All Google services are now active.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check connection status for current user ──────────────────
    if (action === "check-status") {
      const integration = body.integration as string;

      // Check if the user has a stored Google token
      const { data: tokenData } = await supabaseAdmin
        .from("user_gmail_tokens")
        .select("gmail_email, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (tokenData) {
        return new Response(
          JSON.stringify({ status: "connected", email: tokenData.gmail_email }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: check if shared env token matches this user's email
      const sharedToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
      if (sharedToken) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email?.toLowerCase();
        const { clientId, clientSecret } = getClientCredentials();

        if (clientId && clientSecret) {
          try {
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: sharedToken,
                grant_type: "refresh_token",
              }),
            });
            if (tokenRes.ok) {
              const tokenData2 = await tokenRes.json();
              const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                headers: { Authorization: `Bearer ${tokenData2.access_token}` },
              });
              if (profileRes.ok) {
                const profile = await profileRes.json();
                const gmailEmail = (profile.emailAddress || "").toLowerCase();
                if (gmailEmail === userEmail) {
                  // Auto-migrate token and connect all services
                  await supabaseAdmin.from("user_gmail_tokens").upsert({
                    user_id: userId,
                    gmail_email: gmailEmail,
                    refresh_token: sharedToken,
                  }, { onConflict: "user_id" });

                  for (const svc of GOOGLE_SERVICES) {
                    await supabaseAdmin.from("integration_connections").upsert({
                      user_id: userId,
                      integration_id: svc,
                      status: "connected",
                      last_checked_at: new Date().toISOString(),
                      config: { google_email: gmailEmail },
                    }, { onConflict: "user_id,integration_id" });
                  }

                  return new Response(
                    JSON.stringify({ status: "connected", email: gmailEmail }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            }
          } catch {
            // Shared token check failed, treat as not connected
          }
        }
      }

      return new Response(
        JSON.stringify({ status: "available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect ALL Google services for current user ───────────
    if (action === "disconnect") {
      // Remove token
      await supabaseAdmin
        .from("user_gmail_tokens")
        .delete()
        .eq("user_id", userId);

      // Remove all Google service connections
      for (const svc of GOOGLE_SERVICES) {
        await supabaseAdmin
          .from("integration_connections")
          .delete()
          .eq("user_id", userId)
          .eq("integration_id", svc);
      }

      return new Response(
        JSON.stringify({ success: true, disconnectedServices: GOOGLE_SERVICES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});