import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const RC_SERVER = "https://platform.ringcentral.com";
const APP_CALLBACK = "https://erp.rebar.shop/integrations/callback";

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// verifyAuth removed — handled by handleRequest

function getEdgeFunctionCallbackUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/functions/v1/ringcentral-oauth`;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, body, req: rawReq } = ctx;

    // ─── Handle GET: OAuth callback from RingCentral ──────────────
    const url = new URL(rawReq.url);
    if (rawReq.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) {
      return await handleOAuthCallback(url);
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = body.action as string;

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");

    // ─── Generate OAuth URL ────────────────────────────────────────
    if (action === "get-auth-url") {
      if (!clientId) throw new Error("RingCentral Client ID not configured");

      const redirectUri = getEdgeFunctionCallbackUrl();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await computeCodeChallenge(codeVerifier);

      await supabaseAdmin
        .from("user_ringcentral_tokens")
        .upsert({ user_id: userId, code_verifier: codeVerifier, rc_email: "", refresh_token: "pending" }, { onConflict: "user_id" });

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email || "";

      const state = `${userId}|ringcentral`;

      const authUrl = new URL(`${RC_SERVER}/restapi/oauth/authorize`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      if (userEmail) authUrl.searchParams.set("login_hint", userEmail);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
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
        const { data: existingConn } = await supabaseAdmin
          .from("integration_connections")
          .select("status, error_message, last_sync_at")
          .eq("user_id", userId)
          .eq("integration_id", "ringcentral")
          .maybeSingle();

        const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
        const lastSyncAge = existingConn?.last_sync_at
          ? Date.now() - new Date(existingConn.last_sync_at).getTime()
          : Infinity;
        const syncIsStale = lastSyncAge > STALE_THRESHOLD_MS;
        const hasError = existingConn?.status === "error";

        // Only set "connected" if sync is recent OR there's no existing error
        const resolvedStatus = (hasError && syncIsStale) ? "error" : "connected";
        const resolvedError = (hasError && syncIsStale) ? existingConn.error_message : null;

        await supabaseAdmin.from("integration_connections").upsert({
          user_id: userId,
          integration_id: "ringcentral",
          status: resolvedStatus,
          last_checked_at: new Date().toISOString(),
          error_message: resolvedError,
          config: { rc_email: tokenData.rc_email },
        }, { onConflict: "user_id,integration_id" });

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

    // ─── Connect via JWT (fallback when OAuth app doesn't support auth code) ──
    if (action === "connect-jwt") {
      const jwt = Deno.env.get("RINGCENTRAL_JWT");
      const jwtClientId = Deno.env.get("RINGCENTRAL_JWT_CLIENT_ID");
      const jwtClientSecret = Deno.env.get("RINGCENTRAL_JWT_CLIENT_SECRET");

      if (!jwt || !jwtClientId || !jwtClientSecret) {
        return new Response(
          JSON.stringify({ error: "JWT credentials not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.warn("JWT token exchange not available:", errText);
        return new Response(
          JSON.stringify({ error: "JWT authentication not supported for this app. Use OAuth instead.", fallback: "oauth" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenRes.json();

      // Get RC extension info
      let rcEmail = "";
      try {
        const extRes = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (extRes.ok) {
          const extData = await extRes.json();
          rcEmail = extData.contact?.email || extData.name || "";
        }
      } catch { /* continue */ }

      // Save tokens for the requesting user
      await supabaseAdmin.from("user_ringcentral_tokens").upsert({
        user_id: userId,
        rc_email: rcEmail,
        refresh_token: `jwt:${jwt}`,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      }, { onConflict: "user_id" });

      return new Response(
        JSON.stringify({ status: "connected", email: rcEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect RingCentral for current user ──────────────────
    if (action === "disconnect") {
      await supabaseAdmin
        .from("user_ringcentral_tokens")
        .delete()
        .eq("user_id", userId);

      // Also remove from integration_connections
      await supabaseAdmin
        .from("integration_connections")
        .delete()
        .eq("user_id", userId)
        .eq("integration_id", "ringcentral");

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

// ─── Server-side OAuth callback handler ─────────────────────────
async function handleOAuthCallback(url: URL): Promise<Response> {
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    const desc = url.searchParams.get("error_description") || errorParam;
    return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent(desc)}`, 302);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";

  // Extract userId from state (format: "userId|ringcentral")
  const parts = state.split("|");
  const userId = parts[0];

  if (!code || !userId) {
    return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent("Missing code or user ID")}`, 302);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;
    const redirectUri = getEdgeFunctionCallbackUrl();

    // Retrieve stored code_verifier for PKCE
    const { data: storedData } = await supabaseAdmin
      .from("user_ringcentral_tokens")
      .select("code_verifier")
      .eq("user_id", userId)
      .maybeSingle();

    const codeVerifier = storedData?.code_verifier;
    if (!codeVerifier) {
      return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent("PKCE verifier not found. Please retry.")}`, 302);
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
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("RC token exchange failed:", errText);
      return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent("Token exchange failed")}`, 302);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent("No refresh token received")}`, 302);
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
      return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent("Failed to save credentials")}`, 302);
    }

    // Write to integration_connections so UI shows connected
    await supabaseAdmin.from("integration_connections").upsert({
      user_id: userId,
      integration_id: "ringcentral",
      status: "connected",
      last_checked_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      error_message: null,
      config: { rc_email: rcEmail },
    }, { onConflict: "user_id,integration_id" });

    return Response.redirect(`${APP_CALLBACK}?status=success&integration=ringcentral`, 302);
  } catch (error) {
    console.error("RingCentral callback error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.redirect(`${APP_CALLBACK}?status=error&integration=ringcentral&message=${encodeURIComponent(msg)}`, 302);
  }
}
