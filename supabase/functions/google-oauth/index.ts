import { encryptToken } from "../_shared/tokenEncryption.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

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

const GOOGLE_SERVICES = Object.keys(SCOPES);
const ALL_GOOGLE_SCOPES = [...new Set(Object.values(SCOPES).flat())];
const SEO_SERVICE_ACCOUNT_EMAIL = "ai@rebar.shop";

function getClientCredentials() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("GMAIL_CLIENT_SECRET");
  return { clientId, clientSecret };
}

async function resolveTargetUser(
  supabaseAdmin: any,
  currentUserId: string,
  seoServiceAccount: boolean,
) {
  if (!seoServiceAccount) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(currentUserId);
    return {
      targetUserId: currentUserId,
      targetEmail: userData?.user?.email || "",
    };
  }

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const aiAccount = usersData?.users?.find((u: any) => u.email === SEO_SERVICE_ACCOUNT_EMAIL);

  if (!aiAccount) {
    throw new Error(`SEO service account ${SEO_SERVICE_ACCOUNT_EMAIL} not found`);
  }

  return {
    targetUserId: aiAccount.id,
    targetEmail: aiAccount.email || SEO_SERVICE_ACCOUNT_EMAIL,
  };
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, body, req: originalReq } = ctx;

    const url = new URL(originalReq.url);
    let action = url.searchParams.get("action");

    if (!action && body.action) action = body.action as string;

    const seoServiceAccount = body.seo_service_account === true;
    const { targetUserId, targetEmail } = await resolveTargetUser(
      supabaseAdmin,
      userId,
      seoServiceAccount,
    );

    if (action === "get-auth-url") {
      const redirectUri = body.redirectUri as string;

      const { clientId } = getClientCredentials();
      if (!clientId) throw new Error("Google Client ID not configured");

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", ALL_GOOGLE_SCOPES.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", "google");
      if (targetEmail) authUrl.searchParams.set("login_hint", targetEmail);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

      let googleEmail = "";
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        googleEmail = profile.emailAddress || "";
      }

      const encryptedRefreshToken = await encryptToken(tokens.refresh_token);
      const { error: upsertError } = await supabaseAdmin
        .from("user_gmail_tokens")
        .upsert({
          user_id: targetUserId,
          gmail_email: googleEmail,
          refresh_token: encryptedRefreshToken,
          is_encrypted: true,
          token_rotated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to save Google token:", upsertError);
        throw new Error("Failed to save Google credentials");
      }

      for (const svc of GOOGLE_SERVICES) {
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            user_id: targetUserId,
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

    if (action === "check-status") {
      const integration = body.integration as string;

      if (!integration || !SCOPES[integration]) {
        return new Response(
          JSON.stringify({ error: "Invalid or missing integration" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tokenData } = await supabaseAdmin
        .from("user_gmail_tokens")
        .select("gmail_email, updated_at")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (tokenData) {
        return new Response(
          JSON.stringify({ status: "connected", email: tokenData.gmail_email }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sharedToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
      if (sharedToken && !seoServiceAccount) {
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
                if (gmailEmail === targetEmail.toLowerCase()) {
                  const encMigrated = await encryptToken(sharedToken);
                  await supabaseAdmin.from("user_gmail_tokens").upsert({
                    user_id: targetUserId,
                    gmail_email: gmailEmail,
                    refresh_token: encMigrated,
                    is_encrypted: true,
                    token_rotated_at: new Date().toISOString(),
                  }, { onConflict: "user_id" });

                  for (const svc of GOOGLE_SERVICES) {
                    await supabaseAdmin.from("integration_connections").upsert({
                      user_id: targetUserId,
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
          }
        }
      }

      return new Response(
        JSON.stringify({ status: "available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      await supabaseAdmin
        .from("user_gmail_tokens")
        .delete()
        .eq("user_id", targetUserId);

      for (const svc of GOOGLE_SERVICES) {
        await supabaseAdmin
          .from("integration_connections")
          .delete()
          .eq("user_id", targetUserId)
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
  }, { functionName: "google-oauth", requireCompany: false, wrapResult: false })
);
