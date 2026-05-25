import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { resolveMetaToken, validateMetaTokenRemote } from "../_shared/metaTokenResolver.ts";



const GRAPH_API = "https://graph.facebook.com/v21.0";

const SCOPES: Record<string, string[]> = {
  facebook: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
    "public_profile",
  ],
  instagram: [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_messages",
    "business_management",
    "public_profile",
  ],
};

function getMetaCredentials() {
  const appId = Deno.env.get("FACEBOOK_APP_ID");
  const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
  return { appId, appSecret };
}

// verifyAuth removed — handled by handleRequest wrapper

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, body } = ctx;

    const action = body.action as string;

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

      // Step 6: Verify granted permissions
      let publishReady = false;
      let grantedScopes: string[] = [];
      let missingScopes: string[] = [];
      try {
        const permRes = await fetch(
          `${GRAPH_API}/me/permissions?access_token=${longLivedToken}`
        );
        if (permRes.ok) {
          const permData = await permRes.json();
          grantedScopes = (permData.data || [])
            .filter((p: any) => p.status === "granted")
            .map((p: any) => p.permission);
          const requiredForPublish = ["pages_read_engagement", "pages_manage_posts"];
          missingScopes = requiredForPublish.filter(s => !grantedScopes.includes(s));
          publishReady = missingScopes.length === 0;
          console.log(`[facebook-oauth] Granted scopes: ${grantedScopes.join(", ")}`);
          if (!publishReady) {
            console.warn(`[facebook-oauth] Missing publish scopes: ${missingScopes.join(", ")}`);
          }
        }
      } catch (permErr) {
        console.error("[facebook-oauth] Permission check failed:", permErr);
      }

      // Step 7: Store tokens securely (per-user) — mirror to BOTH platform rows so
      // Facebook and Instagram stay in sync from a single reconnect.
      const expiresAtIso = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const pagesPayload = pages.map(p => ({ id: p.id, name: p.name }));
      const mainPlatforms: Array<"facebook" | "instagram"> = ["facebook", "instagram"];

      for (const plat of mainPlatforms) {
        const { error: upsertError } = await supabaseAdmin
          .from("user_meta_tokens")
          .upsert({
            user_id: userId,
            platform: plat,
            access_token: longLivedToken,
            token_type: "long_lived",
            meta_user_id: profileName,
            meta_user_name: profileName,
            pages: pagesPayload,
            instagram_accounts: instagramAccounts,
            expires_at: expiresAtIso,
          }, { onConflict: "user_id,platform" });
        if (upsertError) {
          console.error(`Failed to save Meta token for ${plat}:`, upsertError);
          throw new Error("Failed to save credentials");
        }
      }

      // Store page tokens separately under BOTH facebook_page_* and instagram_page_* prefixes
      for (const page of pages) {
        for (const plat of mainPlatforms) {
          await supabaseAdmin
            .from("user_meta_tokens")
            .upsert({
              user_id: userId,
              platform: `${plat}_page_${page.id}`,
              access_token: page.access_token,
              meta_user_name: page.name,
              pages: [{ id: page.id, name: page.name }],
            }, { onConflict: "user_id,platform" });
        }
      }

      // Update BOTH integration_connections rows together so the UI shows a consistent state.
      for (const plat of mainPlatforms) {
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            user_id: userId,
            integration_id: plat,
            status: "connected",
            last_checked_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            error_message: publishReady ? null : `Missing permissions: ${missingScopes.join(", ")}`,
            config: {
              profileName,
              pagesCount: pages.length,
              instagramAccounts: instagramAccounts.length,
              publish_ready: publishReady,
              granted_scopes: grantedScopes,
              missing_scopes: missingScopes,
            },
          }, { onConflict: "user_id,integration_id" });
      }

      const igInfo = instagramAccounts.length > 0
        ? ` + ${instagramAccounts.length} Instagram account(s)`
        : "";
      const permWarning = !publishReady
        ? ` ⚠️ Missing permissions: ${missingScopes.join(", ")}. Publishing may fail. Please ensure your Facebook App has these permissions approved.`
        : "";

      return new Response(
        JSON.stringify({
          success: true,
          profileName,
          pagesCount: pages.length,
          instagramAccounts: instagramAccounts.length,
          publish_ready: publishReady,
          missing_scopes: missingScopes,
          message: `Facebook + Instagram connected as ${profileName}! ${pages.length} page(s)${igInfo}${permWarning}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check connection status ───────────────────────────────────
    if (action === "check-status") {
      const integration = (body.integration as string) === "facebook" ? "facebook" : "instagram";

      // Use unified resolver: self → same-company teammate fallback
      const resolved = await resolveMetaToken(supabaseAdmin, userId, integration);

      if (!resolved) {
        // Sync DB row to "available" so the UI matches truth
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            user_id: userId,
            integration_id: integration,
            status: "error",
            last_checked_at: new Date().toISOString(),
            error_message: "Not connected. Please connect Facebook/Instagram in Integrations.",
          }, { onConflict: "user_id,integration_id" });

        return new Response(
          JSON.stringify({ status: "available" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remote-validate against Meta to catch revoked tokens
      const valid = await validateMetaTokenRemote(resolved.accessToken);
      if (!valid) {
        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            user_id: userId,
            integration_id: integration,
            status: "error",
            last_checked_at: new Date().toISOString(),
            error_message: "Token rejected by Meta. Please reconnect Facebook/Instagram.",
          }, { onConflict: "user_id,integration_id" });

        return new Response(
          JSON.stringify({ status: "error", error: "Token expired. Please reconnect." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Healthy — sync DB row to connected
      await supabaseAdmin
        .from("integration_connections")
        .upsert({
          user_id: userId,
          integration_id: integration,
          status: "connected",
          last_checked_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: "user_id,integration_id" });

      return new Response(
        JSON.stringify({
          status: "connected",
          profileName: resolved.ownedByCurrentUser ? undefined : `(team-shared)`,
          pagesCount: resolved.pages.length,
          source: resolved.source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // ─── Refresh / rediscover IG accounts from existing page tokens ─
    if (action === "refresh-accounts") {
      const integration = (body.integration as string) || "instagram";

      // Find all page token rows for this user
      const { data: pageTokenRows } = await supabaseAdmin
        .from("user_meta_tokens")
        .select("platform, access_token, pages")
        .eq("user_id", userId)
        .like("platform", "%_page_%");

      if (!pageTokenRows || pageTokenRows.length === 0) {
        return new Response(
          JSON.stringify({ error: "No page tokens found. Please reconnect Facebook/Instagram first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let instagramAccounts: Array<{ id: string; username: string; pageId: string }> = [];
      const allPages: Array<{ id: string; name: string }> = [];

      for (const row of pageTokenRows) {
        const pages = (row.pages as Array<{ id: string; name: string }>) || [];
        for (const page of pages) {
          allPages.push(page);
          try {
            const igRes = await fetch(
              `${GRAPH_API}/${page.id}?fields=instagram_business_account{id,username}&access_token=${row.access_token}`
            );
            if (igRes.ok) {
              const igData = await igRes.json();
              console.log(`IG discovery for page ${page.id}:`, JSON.stringify(igData));
              if (igData.instagram_business_account) {
                instagramAccounts.push({
                  id: igData.instagram_business_account.id,
                  username: igData.instagram_business_account.username || "",
                  pageId: page.id,
                });
              }
            } else {
              const errText = await igRes.text();
              console.error(`IG discovery failed for page ${page.id}:`, errText);
            }
          } catch (err) {
            console.error(`IG discovery error for page ${page.id}:`, err);
          }
        }
      }

      // Use the first page token as the main token for the instagram platform row
      const mainToken = pageTokenRows[0].access_token;

      // Upsert main instagram platform row
      const { error: upsertError } = await supabaseAdmin
        .from("user_meta_tokens")
        .upsert({
          user_id: userId,
          platform: integration,
          access_token: mainToken,
          token_type: "long_lived",
          meta_user_name: allPages[0]?.name || "",
          pages: allPages,
          instagram_accounts: instagramAccounts,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "user_id,platform" });

      if (upsertError) {
        console.error("Failed to upsert main token:", upsertError);
        throw new Error("Failed to save refreshed accounts");
      }

      // Also ensure facebook platform row exists
      await supabaseAdmin
        .from("user_meta_tokens")
        .upsert({
          user_id: userId,
          platform: "facebook",
          access_token: mainToken,
          token_type: "long_lived",
          meta_user_name: allPages[0]?.name || "",
          pages: allPages,
          instagram_accounts: instagramAccounts,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "user_id,platform" });

      return new Response(
        JSON.stringify({
          success: true,
          pagesFound: allPages.length,
          instagramAccountsFound: instagramAccounts.length,
          instagramAccounts,
          message: instagramAccounts.length > 0
            ? `Found ${instagramAccounts.length} Instagram Business Account(s): ${instagramAccounts.map(a => a.username || a.id).join(", ")}`
            : "No Instagram Business Accounts linked to your Facebook Pages. Make sure your Page is connected to an Instagram Business Account in Meta Business Suite.",
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

      // Also remove page tokens
      await supabaseAdmin
        .from("user_meta_tokens")
        .delete()
        .eq("user_id", userId)
        .like("platform", `${integration}_page_%`);

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
  }, { functionName: "facebook-oauth", requireCompany: false, wrapResult: false })
);