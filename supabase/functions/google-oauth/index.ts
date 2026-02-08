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

// The stable redirect URI — the edge function itself, with apikey for gateway access
function getRedirectUri(): string {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth?apikey=${anonKey}`;
}

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

// ─── Handle the GET callback from Google ────────────────────────────
async function handleOAuthCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Default fallback URL
  const fallbackUrl = "https://cusum-brain-flow.lovable.app";

  if (error) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${fallbackUrl}/integrations/callback?status=error&message=${encodeURIComponent(error)}` },
    });
  }

  if (!code || !stateParam) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${fallbackUrl}/integrations/callback?status=error&message=${encodeURIComponent("Missing code or state")}` },
    });
  }

  let state: { integration: string; userId: string; returnUrl: string };
  try {
    state = JSON.parse(atob(stateParam));
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: `${fallbackUrl}/integrations/callback?status=error&message=${encodeURIComponent("Invalid state")}` },
    });
  }

  const { integration, userId, returnUrl } = state;
  const appUrl = returnUrl || fallbackUrl;

  try {
    const { clientId, clientSecret } = getClientCredentials();
    if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

    const redirectUri = getRedirectUri();

    // Exchange code for tokens
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
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      throw new Error("No refresh token received. Please revoke app access in your Google Account and try again.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Gmail email if connecting Gmail
    let gmailEmail = "";
    if (integration === "gmail") {
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        gmailEmail = profile.emailAddress || "";
      }
    }

    // Save token for Gmail
    if (integration === "gmail" && tokens.refresh_token) {
      const { error: upsertError } = await supabaseAdmin
        .from("user_gmail_tokens")
        .upsert({
          user_id: userId,
          gmail_email: gmailEmail,
          refresh_token: tokens.refresh_token,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to save Gmail token:", upsertError);
        throw new Error("Failed to save Gmail credentials");
      }
    }

    // Update integration status
    await supabaseAdmin
      .from("integration_connections")
      .upsert({
        integration_id: integration,
        status: "connected",
        last_checked_at: new Date().toISOString(),
        error_message: null,
        config: { hasRefreshToken: true },
      }, { onConflict: "integration_id" });

    // Redirect back to the app with success
    const successUrl = `${appUrl}/integrations/callback?status=success&integration=${encodeURIComponent(integration)}&email=${encodeURIComponent(gmailEmail)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: successUrl },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integrations/callback?status=error&message=${encodeURIComponent(message)}` },
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── Handle GET = OAuth callback from Google ─────────────────────
  if (req.method === "GET") {
    return handleOAuthCallback(req);
  }

  // ─── Handle POST = API calls from frontend ──────────────────────
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

    // ─── Generate OAuth URL ────────────────────────────────────────
    if (action === "get-auth-url") {
      const integration = body.integration as string;
      const returnUrl = (body.returnUrl as string) || "https://cusum-brain-flow.lovable.app";

      const { clientId } = getClientCredentials();
      if (!clientId) throw new Error("Google Client ID not configured");

      // Get user's email to pre-fill the login hint
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email || "";

      // Encode state with integration, userId, and returnUrl
      const state = btoa(JSON.stringify({ integration, userId, returnUrl }));

      const scopes = SCOPES[integration] || SCOPES.gmail;
      const redirectUri = getRedirectUri();

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      if (userEmail) authUrl.searchParams.set("login_hint", userEmail);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check connection status for current user ──────────────────
    if (action === "check-status") {
      const integration = body.integration as string;

      if (integration === "gmail") {
        // Check if the user has a stored token
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
                    // Auto-migrate token
                    await supabaseAdmin.from("user_gmail_tokens").upsert({
                      user_id: userId,
                      gmail_email: gmailEmail,
                      refresh_token: sharedToken,
                    }, { onConflict: "user_id" });

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
          JSON.stringify({ status: "not_connected" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For non-gmail integrations, use the old shared-token approach
      const { clientId, clientSecret } = getClientCredentials();
      const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

      if (!clientId || !clientSecret || !refreshToken) {
        return new Response(
          JSON.stringify({ status: "available", error: "Credentials not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        return new Response(
          JSON.stringify({ status: "error", error: "Token invalid or expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ status: "connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect Gmail for current user ─────────────────────────
    if (action === "disconnect") {
      const integration = body.integration as string;
      if (integration === "gmail") {
        await supabaseAdmin
          .from("user_gmail_tokens")
          .delete()
          .eq("user_id", userId);
      }

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
    console.error("Google OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
