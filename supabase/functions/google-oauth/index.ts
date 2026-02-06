import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Google OAuth scopes for different integrations
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
};

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    // Parse body once for all actions
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON
    }

    // Also check for action in body (supabase.functions.invoke doesn't pass query params well)
    if (!action && body.action) {
      action = body.action as string;
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle different actions
    if (action === "get-auth-url") {
      // Generate OAuth authorization URL
      const integration = body.integration as string;
      const redirectUri = body.redirectUri as string;

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
      if (!clientId) {
        throw new Error("Google Client ID not configured");
      }

      const scopes = SCOPES[integration] || SCOPES.gmail;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", integration);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange-code") {
      // Exchange authorization code for tokens
      const code = body.code as string;
      const redirectUri = body.redirectUri as string;
      const integration = body.integration as string;

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("GMAIL_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials not configured");
      }

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

      // Update integration status in database
      await supabaseAdmin
        .from("integration_connections")
        .upsert({
          integration_id: integration,
          status: "connected",
          last_checked_at: new Date().toISOString(),
          error_message: null,
          config: { hasRefreshToken: !!tokens.refresh_token },
        }, { onConflict: "integration_id" });

      return new Response(
        JSON.stringify({
          success: true,
          refreshToken: tokens.refresh_token,
          message: "Authorization successful! Please save the refresh token as a secret.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check-status") {
      // Check if an integration is connected
      const integration = body.integration as string;

      // Try to verify the connection by refreshing the token
      let clientId: string | undefined;
      let clientSecret: string | undefined;
      let refreshToken: string | undefined;

      if (integration === "gmail") {
        clientId = Deno.env.get("GMAIL_CLIENT_ID");
        clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
        refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
      } else if (integration === "google-calendar") {
        clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
        clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
        refreshToken = Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN");
      } else if (integration === "google-drive") {
        clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
        clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
        refreshToken = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN");
      }

      if (!clientId || !clientSecret || !refreshToken) {
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            integration_id: integration,
            status: "available",
            last_checked_at: new Date().toISOString(),
            error_message: "Credentials not configured",
          }, { onConflict: "integration_id" });

        return new Response(
          JSON.stringify({ status: "available", error: "Credentials not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to refresh the token
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
        const error = await tokenResponse.text();
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            integration_id: integration,
            status: "error",
            last_checked_at: new Date().toISOString(),
            error_message: error.includes("invalid_grant") ? "Token expired - please reconnect" : "Connection error",
          }, { onConflict: "integration_id" });

        return new Response(
          JSON.stringify({ status: "error", error: "Token invalid or expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Token is valid
      await supabaseAdmin
        .from("integration_connections")
        .upsert({
          integration_id: integration,
          status: "connected",
          last_checked_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: "integration_id" });

      return new Response(
        JSON.stringify({ status: "connected" }),
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
