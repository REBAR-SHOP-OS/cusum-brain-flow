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
  }, { functionName: "linkedin-oauth", authMode: "optional", requireCompany: false, wrapResult: false })
);

// ─── OAuth Callback ────────────────────────────────────────────────

async function handleCallback(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  clientId: string,
  clientSecret: string
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

  const { error: dbError } = await supabase
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: "linkedin",
      status: "connected",
      config: {
        access_token: tokens.access_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        refresh_token: tokens.refresh_token || null,
        profile_name: profileName,
        scope: tokens.scope,
      },
      last_sync_at: new Date().toISOString(),
      error_message: null,
    }, { onConflict: "user_id,integration_id" });

  if (dbError) {
    console.error("Failed to store LinkedIn tokens:", dbError);
    throw new Error("Failed to store tokens");
  }

  // Redirect back to app's own callback page (same origin → popup closes reliably)
  const appBase = returnUrl || "https://erp.rebar.shop";
  const successUrl = new URL("/integrations/callback", appBase);
  successUrl.searchParams.set("status", "success");
  successUrl.searchParams.set("integration", "linkedin");
  successUrl.searchParams.set("email", profileName);
  return Response.redirect(successUrl.toString(), 302);
}

// ─── Auth URL ──────────────────────────────────────────────────────

function handleGetAuthUrl(supabaseUrl: string, clientId: string, userId: string, body: Record<string, unknown>) {
  const redirectUri = `${supabaseUrl}/functions/v1/linkedin-oauth/callback`;
  const scope = "openid profile email w_member_social";
  const state = `${userId}|${body.returnUrl || ""}`;

  const authUrl = new URL(LINKEDIN_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return jsonRes({ authUrl: authUrl.toString() });
}

// ─── Check Status ──────────────────────────────────────────────────

async function handleCheckStatus(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return jsonRes({ status: "available" });
  }

  const config = connection.config as { access_token: string; expires_at: number; profile_name: string };

  if (config.expires_at < Date.now()) {
    await supabase
      .from("integration_connections")
      .update({ status: "error", error_message: "Token expired, please reconnect" })
      .eq("user_id", userId)
      .eq("integration_id", "linkedin");

    return jsonRes({ status: "error", error: "Token expired, please reconnect" });
  }

  return jsonRes({ status: "connected", profileName: config.profile_name });
}

// ─── Disconnect ────────────────────────────────────────────────────

async function handleDisconnect(supabase: ReturnType<typeof createClient>, userId: string) {
  await supabase
    .from("integration_connections")
    .delete()
    .eq("user_id", userId)
    .eq("integration_id", "linkedin");

  return jsonRes({ success: true });
}

// ─── Get Profile ───────────────────────────────────────────────────

async function handleGetProfile(supabase: ReturnType<typeof createClient>, userId: string) {
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

async function handleCreatePost(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
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

async function handleListPosts(supabase: ReturnType<typeof createClient>, userId: string) {
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
    }
  );

  if (!postsRes.ok) {
    const errText = await postsRes.text();
    console.error("LinkedIn list posts error:", errText);
    throw new Error(`Failed to list posts (${postsRes.status})`);
  }

  const data = await postsRes.json();
  return jsonRes({ posts: data.elements || [] });
}
