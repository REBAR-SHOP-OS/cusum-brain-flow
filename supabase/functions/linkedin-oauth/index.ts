import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

// ─── Helpers ───────────────────────────────────────────────────────

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getScopeSet(scope?: string): Set<string> {
  return new Set(
    (scope || "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
  );
}

function getLinkedInStatusError(
  config: {
    access_token?: string;
    expires_at?: number;
    refresh_token?: string | null;
    scope?: string;
    organization_ids?: Record<string, string>;
  },
) {
  const reasons: string[] = [];
  const scopeSet = getScopeSet(config.scope);

  if (!config.access_token) reasons.push("no access token is stored");
  if ((config.expires_at || 0) < Date.now() && !config.refresh_token) {
    reasons.push("the authorization is expired and cannot auto-refresh");
  }
  if (
    scopeSet.size > 0 &&
    (!scopeSet.has("offline_access") ||
      !scopeSet.has("w_organization_social") ||
      !scopeSet.has("r_organization_social"))
  ) {
    reasons.push(
      "the LinkedIn App is missing offline_access / Marketing Developer Platform approval — Reconnect alone will not fix this",
    );
  }

  const detail = reasons.length > 0
    ? ` (${Array.from(new Set(reasons)).join("; ")})`
    : "";
  return `Reconnect LinkedIn from Settings → Integrations${detail}.`;
}

// Minimum scopes the LinkedIn App MUST grant for personal publishing to work.
// Without these we cannot post anything at all, so the connection must be flagged "error".
const MIN_LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "w_member_social",
];
// Optional scopes that unlock auto-refresh and company-page publishing. Missing these
// downgrades capabilities but does NOT break personal posting, so we surface a warning
// in error_message but keep status = "connected".
const OPTIONAL_LINKEDIN_SCOPES = [
  "offline_access",
  "w_organization_social",
  "r_organization_social",
];

// ─── Main Handler ──────────────────────────────────────────────────

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabase, body, req: rawReq } = ctx;

    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!clientId || !clientSecret) {
      throw new Error("LinkedIn credentials not configured");
    }

    const url = new URL(rawReq.url);
    const pathParts = url.pathname.split("/");
    const pathAction = pathParts[pathParts.length - 1];

    // ─── OAuth Callback (no auth header) ─────────────────────────
    if (pathAction === "callback") {
      return handleCallback(url, supabase, supabaseUrl, clientId, clientSecret);
    }

    // ─── All other actions require authentication ────────────────
    if (!userId) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const { action } = body;

    switch (action) {
      case "get-auth-url":
        return handleGetAuthUrl(supabaseUrl, clientId, userId, body);
      case "check-status":
        return handleCheckStatus(supabase, userId);
      case "disconnect":
        return handleDisconnect(supabase, userId);
      case "get-profile":
        return handleGetProfile(supabase, userId);
      case "create-post":
        return handleCreatePost(supabase, userId, body);
      case "list-posts":
        return handleListPosts(supabase, userId);
      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  }, {
    functionName: "linkedin-oauth",
    authMode: "optional",
    requireCompany: false,
    wrapResult: false,
  })
);

// ─── OAuth Callback ────────────────────────────────────────────────

async function handleCallback(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  clientId: string,
  clientSecret: string,
) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("LinkedIn OAuth error:", error);
    const errUrl = new URL("/integrations/callback", "https://erp.rebar.shop");
    errUrl.searchParams.set("status", "error");
    errUrl.searchParams.set("message", `Authorization denied: ${error}`);
    return Response.redirect(errUrl.toString(), 302);
  }

  if (!code) throw new Error("Missing code in callback");

  let userId = "";
  let returnUrl = "";
  if (state) {
    const parts = state.split("|");
    userId = parts[0] || "";
    returnUrl = parts.slice(1).join("|") || "";
  }

  if (!userId) throw new Error("Missing user context in OAuth callback");

  const redirectUri = `${supabaseUrl}/functions/v1/linkedin-oauth/callback`;

  const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("LinkedIn token exchange failed:", tokens);
    throw new Error(tokens.error_description || "Token exchange failed");
  }

  // Get LinkedIn profile info
  let profileName = "LinkedIn User";
  try {
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      profileName = profile.name || profile.given_name || "LinkedIn User";
    }
  } catch (e) {
    console.error("Failed to fetch LinkedIn profile:", e);
  }

  // Auto-discover LinkedIn Organization pages the user administers
  let organizationIds: Record<string, string> = {};
  try {
    const aclRes = await fetch(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName),organization))",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (aclRes.ok) {
      const aclData = await aclRes.json();
      const elements = aclData.elements || [];
      for (const el of elements) {
        const orgUrn = el.organization || "";
        const orgId = orgUrn.split(":").pop() || "";
        const orgName = el["organization~"]?.localizedName;
        if (orgId && orgName) {
          organizationIds[orgName] = orgId;
          console.log(
            `[linkedin-oauth] Discovered org: "${orgName}" → ${orgId}`,
          );
        }
      }
    } else {
      console.warn(
        `[linkedin-oauth] Organization ACL fetch failed (${aclRes.status}) — org publishing won't be available until reconnect`,
      );
    }
  } catch (e) {
    console.warn("[linkedin-oauth] Failed to fetch organizations:", e);
  }

  // Validate scopes. Two tiers:
  //   - MIN_LINKEDIN_SCOPES missing → connection is unusable, mark as "error".
  //   - OPTIONAL_LINKEDIN_SCOPES missing → keep "connected" but record a warning so
  //     the UI can tell the user that auto-refresh / company-page publishing is off
  //     until the LinkedIn App is approved for those products.
  const grantedScopes = new Set(
    String(tokens.scope || "").split(/[\s,]+/).map((s) => s.trim()).filter(
      Boolean,
    ),
  );
  const missingRequired = MIN_LINKEDIN_SCOPES.filter((s) => !grantedScopes.has(s));
  const missingOptional = OPTIONAL_LINKEDIN_SCOPES.filter((s) => !grantedScopes.has(s));
  if (missingRequired.length > 0 || missingOptional.length > 0) {
    console.warn(
      `[linkedin-oauth] Scopes missing — required: [${missingRequired.join(", ")}], optional: [${missingOptional.join(", ")}]. Granted: ${tokens.scope}`,
    );
  }

  // Preserve previously discovered organization_ids when the new grant cannot rediscover them
  // (e.g. r_organization_social was dropped this round). Never silently wipe a working setup.
  let mergedOrganizationIds = organizationIds;
  if (Object.keys(organizationIds).length === 0) {
    const { data: prev } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("integration_id", "linkedin")
      .maybeSingle();
    const prevOrgs =
      (prev?.config as { organization_ids?: Record<string, string> })
        ?.organization_ids || {};
    if (Object.keys(prevOrgs).length > 0) {
      mergedOrganizationIds = prevOrgs;
      console.log(
        `[linkedin-oauth] Preserved ${
          Object.keys(prevOrgs).length
        } previously discovered org(s) — current grant could not rediscover them`,
      );
    }
  }

  const connectionStatus = missingRequired.length > 0 ? "error" : "connected";
  let connectionErrorMessage: string | null = null;
  if (missingRequired.length > 0) {
    connectionErrorMessage =
      `LinkedIn did not grant required scopes: ${missingRequired.join(", ")}. Enable "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" in the LinkedIn Developer Portal, then Reconnect.`;
  } else if (missingOptional.length > 0) {
    connectionErrorMessage =
      `Personal publishing is enabled. Some capabilities are off because the LinkedIn App did not grant: ${missingOptional.join(", ")}. ` +
      `Without offline_access the token expires every ~60 days and must be reconnected manually. ` +
      `Without w_organization_social/r_organization_social, company-page publishing is disabled — enable the "Community Management API" product in the LinkedIn Developer Portal and Reconnect to unlock it.`;
  }

  const { error: dbError } = await supabase
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: "linkedin",
      status: connectionStatus,
      config: {
        access_token: tokens.access_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        refresh_token: tokens.refresh_token || null,
        profile_name: profileName,
        scope: tokens.scope,
        organization_ids: mergedOrganizationIds,
      },
      last_sync_at: new Date().toISOString(),
      error_message: connectionErrorMessage,
    }, { onConflict: "user_id,integration_id" });

  if (dbError) {
    console.error("Failed to store LinkedIn tokens:", dbError);
    throw new Error("Failed to store tokens");
  }

  // Redirect back to app's own callback page (same origin → popup closes reliably)
  const appBase = returnUrl || "https://erp.rebar.shop";
  const successUrl = new URL("/integrations/callback", appBase);
  if (missingRequired.length > 0) {
    successUrl.searchParams.set("status", "error");
    successUrl.searchParams.set("integration", "linkedin");
    successUrl.searchParams.set("message", connectionErrorMessage!);
  } else {
    successUrl.searchParams.set("status", "success");
    successUrl.searchParams.set("integration", "linkedin");
    successUrl.searchParams.set("email", profileName);
    if (connectionErrorMessage) {
      successUrl.searchParams.set("warning", connectionErrorMessage);
    }
  }
  return Response.redirect(successUrl.toString(), 302);
}

// ─── Auth URL ──────────────────────────────────────────────────────

function handleGetAuthUrl(
  supabaseUrl: string,
  clientId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const redirectUri = `${supabaseUrl}/functions/v1/linkedin-oauth/callback`;
  // scopeMode:
  //   "personal" (DEFAULT) → minimal known-good set: Sign In with LinkedIn (OIDC) +
  //                Share on LinkedIn. Lets personal posting work even when the App
  //                is not yet approved for Community Management API.
  //   "full"     → adds offline_access + org scopes. ONLY use after the LinkedIn App
  //                has Community Management API approved, otherwise LinkedIn returns
  //                invalid_scope_error and the user sees "Bummer, something went wrong".
  const scopeMode = String(body.scopeMode || "personal").toLowerCase() === "full"
    ? "full"
    : "personal";
  const scope = scopeMode === "personal"
    ? "openid profile email w_member_social"
    : "openid profile email w_member_social w_organization_social r_organization_social offline_access";
  const state = `${userId}|${body.returnUrl || ""}`;

  const authUrl = new URL(LINKEDIN_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  // Temporary diagnostic logging — NO secrets/tokens. Safe to log:
  //   client_id (public OAuth identifier), redirect_uri (whitelisted), scope list, scopeMode.
  console.log("[linkedin-oauth] get-auth-url", JSON.stringify({
    scopeMode,
    scope,
    client_id: clientId,
    redirect_uri: redirectUri,
    authorize_host: authUrl.host,
  }));

  return jsonRes({ authUrl: authUrl.toString(), scopeMode });
}

}

// ─── Check Status ──────────────────────────────────────────────────

async function handleCheckStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return jsonRes({ status: "available" });
  }

  const config = connection.config as {
    access_token: string;
    expires_at: number;
    profile_name: string;
    refresh_token?: string;
  };

  const reconnectError = getLinkedInStatusError(
    connection.config as {
      access_token?: string;
      expires_at?: number;
      refresh_token?: string | null;
      scope?: string;
      organization_ids?: Record<string, string>;
    },
  );

  const scopeSet = getScopeSet(
    (connection.config as { scope?: string })?.scope,
  );
  // Only flag the connection as broken when MIN scopes are missing. Missing optional
  // scopes (offline_access / org scopes) downgrade capabilities but personal posting
  // still works, so we keep the connection usable.
  const missingMinScopes = !scopeSet.has("openid") ||
    !scopeSet.has("profile") ||
    !scopeSet.has("w_member_social");

  if (!config.access_token || missingMinScopes) {
    await supabase
      .from("integration_connections")
      .update({ status: "error", error_message: reconnectError })
      .eq("user_id", userId)
      .eq("integration_id", "linkedin");

    return jsonRes({ status: "error", error: reconnectError });
  }

  if (config.expires_at < Date.now()) {
    // Attempt auto-refresh before marking as error
    if (config.refresh_token) {
      const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
      const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");

      if (clientId && clientSecret) {
        try {
          const res = await fetch(
            "https://www.linkedin.com/oauth/v2/accessToken",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: config.refresh_token,
                client_id: clientId,
                client_secret: clientSecret,
              }),
            },
          );

          if (res.ok) {
            const tokens = await res.json();
            const newConfig = {
              ...config,
              access_token: tokens.access_token,
              expires_at: Date.now() + (tokens.expires_in * 1000),
              ...(tokens.refresh_token
                ? { refresh_token: tokens.refresh_token }
                : {}),
            };

            await supabase
              .from("integration_connections")
              .update({
                config: newConfig,
                status: "connected",
                error_message: null,
                last_sync_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("integration_id", "linkedin");

            console.log(
              "[linkedin-oauth] Token auto-refreshed during status check for user",
              userId,
            );
            return jsonRes({
              status: "connected",
              profileName: config.profile_name,
            });
          } else {
            const errText = await res.text();
            console.error(
              "[linkedin-oauth] Refresh failed during status check:",
              res.status,
              errText,
            );
          }
        } catch (err) {
          console.error(
            "[linkedin-oauth] Refresh exception during status check:",
            err,
          );
        }
      }
    }

    // Refresh failed or no refresh token — mark as error
    await supabase
      .from("integration_connections")
      .update({ status: "error", error_message: reconnectError })
      .eq("user_id", userId)
      .eq("integration_id", "linkedin");

    return jsonRes({ status: "error", error: reconnectError });
  }

  return jsonRes({ status: "connected", profileName: config.profile_name });
}

// ─── Disconnect ────────────────────────────────────────────────────

async function handleDisconnect(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  await supabase
    .from("integration_connections")
    .delete()
    .eq("user_id", userId)
    .eq("integration_id", "linkedin");

  return jsonRes({ success: true });
}

// ─── Get Profile ───────────────────────────────────────────────────

async function handleGetProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .maybeSingle();

  if (!connection) throw new Error("LinkedIn not connected");
  const config = connection.config as { access_token: string };

  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch LinkedIn profile");
  return jsonRes(await res.json());
}

// ─── Create Post ───────────────────────────────────────────────────

async function handleCreatePost(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .maybeSingle();

  if (!connection) throw new Error("LinkedIn not connected");
  const config = connection.config as { access_token: string };
  const { text, visibility } = body as { text: string; visibility?: string };

  if (!text) throw new Error("Post text is required");

  // Get the user's LinkedIn URN
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!profileRes.ok) throw new Error("Failed to get LinkedIn identity");
  const profile = await profileRes.json();

  const payload = {
    author: `urn:li:person:${profile.sub}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility || "PUBLIC",
    },
  };

  const postRes = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    console.error("LinkedIn post error:", errText);
    throw new Error(`LinkedIn API error (${postRes.status})`);
  }

  return jsonRes({ success: true, postId: postRes.headers.get("x-restli-id") });
}

// ─── List Posts ────────────────────────────────────────────────────

async function handleListPosts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .maybeSingle();

  if (!connection) throw new Error("LinkedIn not connected");
  const config = connection.config as { access_token: string };

  // Get user URN first
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!profileRes.ok) throw new Error("Failed to get LinkedIn identity");
  const profile = await profileRes.json();

  const postsRes = await fetch(
    `${LINKEDIN_API_BASE}/ugcPosts?q=authors&authors=List(urn%3Ali%3Aperson%3A${profile.sub})&count=20`,
    {
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );

  if (!postsRes.ok) {
    const errText = await postsRes.text();
    console.error("LinkedIn list posts error:", errText);
    throw new Error(`Failed to list posts (${postsRes.status})`);
  }

  const data = await postsRes.json();
  return jsonRes({ posts: data.elements || [] });
}
