import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

const SCOPES: Record<string, string[]> = {
  facebook: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_manage_posts",
    "public_profile",
  ],
  instagram: [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_manage_comments",
    "instagram_content_publish",
    "public_profile",
  ],
};

function getMetaCredentials() {
  const appId = Deno.env.get("FACEBOOK_APP_ID");
  const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
  return { appId, appSecret };
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

    // ─── Generate OAuth URL ────────────────────────────────────────
    if (action === "get-auth-url") {
      const integration = body.integration as string;
      const redirectUri = body.redirectUri as string;

      const { appId } = getMetaCredentials();
      if (!appId) throw new Error("Facebook App ID not configured");

      const scopes = SCOPES[integration] || SCOPES.facebook;
      const allScopes = integration === "instagram"
        ? [...new Set([...SCOPES.facebook, ...SCOPES.instagram])]
        : scopes;

      const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", allScopes.join(","));
      authUrl.searchParams.set("state", integration);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Exchange code for tokens ──────────────────────────────────
    if (action === "exchange-code") {
      const code = body.code as string;
      const redirectUri = body.redirectUri as string;
      const integration = body.integration as string;

      const { appId, appSecret } = getMetaCredentials();
      if (!appId || !appSecret) throw new Error("Facebook OAuth credentials not configured");

      // Step 1: Exchange code for short-lived token
      const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);

      const tokenResponse = await fetch(tokenUrl.toString());
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }
      const shortLivedData = await tokenResponse.json();

      // Step 2: Exchange for long-lived token (60 days)
      const longLivedUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedData.access_token);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      let longLivedToken = shortLivedData.access_token;
      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json();
        longLivedToken = longLivedData.access_token;
      }

      // Step 3: Get user profile info
      const profileRes = await fetch(
        `${GRAPH_API}/me?fields=id,name,email&access_token=${longLivedToken}`
      );
      let profileName = "";
      if (profileRes.ok) {
        const profile = await profileRes.json();
        profileName = profile.name || "";
      }

      // Step 4: Get pages
      let pages: Array<{ id: string; name: string; access_token: string }> = [];
      const pagesRes = await fetch(
        `${GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`
      );
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        pages = pagesData.data || [];
      }

      // Step 5: If Instagram, get Instagram Business Account IDs
      let instagramAccounts: Array<{ id: string; username: string; pageId: string }> = [];
      if (integration === "instagram" && pages.length > 0) {
        for (const page of pages) {
          try {
            const igRes = await fetch(
              `${GRAPH_API}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`
            );
            if (igRes.ok) {
              const igData = await igRes.json();
              if (igData.instagram_business_account) {
                instagramAccounts.push({
                  id: igData.instagram_business_account.id,
                  username: igData.instagram_business_account.username || "",
                  pageId: page.id,
                });
              }
            }
          } catch {
            // Skip pages without IG accounts
          }
        }
      }

      // Step 6: Store tokens securely (per-user)
      const { error: upsertError } = await supabaseAdmin
        .from("user_meta_tokens")
        .upsert({
          user_id: userId,
          platform: integration,
          access_token: longLivedToken,
          token_type: "long_lived",
          meta_user_id: profileName,
          meta_user_name: profileName,
          pages: pages.map(p => ({ id: p.id, name: p.name })),
          instagram_accounts: instagramAccounts,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "user_id,platform" });

      if (upsertError) {
        console.error("Failed to save Meta token:", upsertError);
        throw new Error("Failed to save credentials");
      }

      // Store page tokens separately
      for (const page of pages) {
        await supabaseAdmin
          .from("user_meta_tokens")
          .upsert({
            user_id: userId,
            platform: `${integration}_page_${page.id}`,
            access_token: page.access_token,
            meta_user_name: page.name,
            pages: [{ id: page.id, name: page.name }],
          }, { onConflict: "user_id,platform" });
      }

      // Update per-user integration status
      await supabaseAdmin
        .from("integration_connections")
        .upsert({
          user_id: userId,
          integration_id: integration,
          status: "connected",
          last_checked_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          error_message: null,
          config: {
            profileName,
            pagesCount: pages.length,
            instagramAccounts: instagramAccounts.length,
          },
        }, { onConflict: "user_id,integration_id" });

      const igInfo = instagramAccounts.length > 0
        ? ` + ${instagramAccounts.length} Instagram account(s)`
        : "";

      return new Response(
        JSON.stringify({
          success: true,
          profileName,
          pagesCount: pages.length,
          instagramAccounts: instagramAccounts.length,
          message: `${integration === "instagram" ? "Instagram" : "Facebook"} connected as ${profileName}! ${pages.length} page(s)${igInfo}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check connection status ───────────────────────────────────
    if (action === "check-status") {
      const integration = body.integration as string;

      const { data: tokenData } = await supabaseAdmin
        .from("user_meta_tokens")
        .select("meta_user_name, expires_at, pages, instagram_accounts")
        .eq("user_id", userId)
        .eq("platform", integration)
        .maybeSingle();

      if (!tokenData) {
        return new Response(
          JSON.stringify({ status: "available" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date();
      if (isExpired) {
        return new Response(
          JSON.stringify({ status: "error", error: "Token expired. Please reconnect." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "connected",
          profileName: tokenData.meta_user_name,
          pagesCount: (tokenData.pages as unknown[])?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect (per-user) ─────────────────────────────────────
    if (action === "disconnect") {
      const integration = body.integration as string;

      // Remove tokens
      await supabaseAdmin
        .from("user_meta_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("platform", integration);

      // Remove per-user connection status
      await supabaseAdmin
        .from("integration_connections")
        .delete()
        .eq("user_id", userId)
        .eq("integration_id", integration);

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
    console.error("Facebook OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});