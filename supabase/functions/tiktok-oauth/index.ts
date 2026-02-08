import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

// ─── Helpers ───────────────────────────────────────────────────────

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
  if (error || !data?.user) return null;
  return data.user.id;
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");

    if (!clientKey || !clientSecret) {
      throw new Error("TikTok credentials not configured");
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const pathAction = pathParts[pathParts.length - 1];

    // ─── OAuth Callback (no auth header) ─────────────────────────
    if (pathAction === "callback") {
      return handleCallback(url, supabase, supabaseUrl, clientKey, clientSecret);
    }

    // ─── All other actions require authentication ────────────────
    const userId = await verifyAuth(req);
    if (!userId) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case "get-auth-url":
        return handleGetAuthUrl(supabaseUrl, clientKey, userId, body);
      case "check-status":
        return handleCheckStatus(supabase, userId);
      case "disconnect":
        return handleDisconnect(supabase, userId);
      case "get-profile":
        return handleGetProfile(supabase, userId);
      case "upload-video":
        return handleUploadVideo(supabase, userId, body);
      case "list-videos":
        return handleListVideos(supabase, userId);
      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("TikTok OAuth error:", error);
    return jsonRes(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

// ─── OAuth Callback ────────────────────────────────────────────────

async function handleCallback(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  clientKey: string,
  clientSecret: string
) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("TikTok OAuth error:", error);
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'oauth-error',error:'${error}'},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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

  const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth/callback`;

  const tokenResponse = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || tokens.error) {
    console.error("TikTok token exchange failed:", tokens);
    throw new Error(tokens.error_description || tokens.message || "Token exchange failed");
  }

  const tokenData = tokens.data || tokens;
  const accessToken = tokenData.access_token;
  const openId = tokenData.open_id;

  // Get TikTok user info
  let displayName = "TikTok User";
  try {
    const userRes = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      displayName = userData.data?.user?.display_name || "TikTok User";
    }
  } catch (e) {
    console.error("Failed to fetch TikTok profile:", e);
  }

  const { error: dbError } = await supabase
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: "tiktok",
      status: "connected",
      config: {
        access_token: accessToken,
        refresh_token: tokenData.refresh_token || null,
        expires_at: Date.now() + ((tokenData.expires_in || 86400) * 1000),
        refresh_expires_at: tokenData.refresh_expires_in
          ? Date.now() + (tokenData.refresh_expires_in * 1000)
          : null,
        open_id: openId,
        display_name: displayName,
        scope: tokenData.scope,
      },
      last_sync_at: new Date().toISOString(),
      error_message: null,
    }, { onConflict: "user_id,integration_id" });

  if (dbError) {
    console.error("Failed to store TikTok tokens:", dbError);
    throw new Error("Failed to store tokens");
  }

  return new Response(
    `<html><body><script>window.opener?.postMessage({type:'oauth-success',integration:'tiktok'},'*');window.close();</script><p>TikTok connected! You can close this window.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// ─── Auth URL ──────────────────────────────────────────────────────

function handleGetAuthUrl(supabaseUrl: string, clientKey: string, userId: string, body: Record<string, unknown>) {
  const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth/callback`;
  const scope = "user.info.basic,video.list,video.publish";
  const state = `${userId}|${body.returnUrl || ""}`;

  const authUrl = new URL(TIKTOK_AUTH_URL);
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
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
    .eq("integration_id", "tiktok")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return jsonRes({ status: "available" });
  }

  const config = connection.config as { access_token: string; expires_at: number; display_name: string };

  if (config.expires_at < Date.now()) {
    await supabase
      .from("integration_connections")
      .update({ status: "error", error_message: "Token expired, please reconnect" })
      .eq("user_id", userId)
      .eq("integration_id", "tiktok");

    return jsonRes({ status: "error", error: "Token expired, please reconnect" });
  }

  return jsonRes({ status: "connected", displayName: config.display_name });
}

// ─── Disconnect ────────────────────────────────────────────────────

async function handleDisconnect(supabase: ReturnType<typeof createClient>, userId: string) {
  // Revoke token
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "tiktok")
    .maybeSingle();

  if (connection) {
    const config = connection.config as { access_token: string };
    try {
      await fetch(`${TIKTOK_API_BASE}/oauth/revoke/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: Deno.env.get("TIKTOK_CLIENT_KEY")!,
          client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET")!,
          token: config.access_token,
        }),
      });
    } catch (e) {
      console.error("TikTok token revoke failed:", e);
    }
  }

  await supabase
    .from("integration_connections")
    .delete()
    .eq("user_id", userId)
    .eq("integration_id", "tiktok");

  return jsonRes({ success: true });
}

// ─── Get Profile ───────────────────────────────────────────────────

async function handleGetProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "tiktok")
    .maybeSingle();

  if (!connection) throw new Error("TikTok not connected");
  const config = connection.config as { access_token: string };

  const res = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,display_name,avatar_url,follower_count,likes_count,video_count`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch TikTok profile");
  return jsonRes(await res.json());
}

// ─── Upload Video ──────────────────────────────────────────────────

async function handleUploadVideo(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "tiktok")
    .maybeSingle();

  if (!connection) throw new Error("TikTok not connected");
  const config = connection.config as { access_token: string };
  const { videoUrl, title, privacyLevel } = body as { videoUrl: string; title?: string; privacyLevel?: string };

  if (!videoUrl) throw new Error("Video URL is required");

  // Initialize video upload
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: title || "",
        privacy_level: privacyLevel || "SELF_ONLY",
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    console.error("TikTok upload init error:", errText);
    throw new Error(`TikTok API error (${initRes.status})`);
  }

  const initData = await initRes.json();
  return jsonRes({ success: true, publishId: initData.data?.publish_id });
}

// ─── List Videos ───────────────────────────────────────────────────

async function handleListVideos(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("integration_id", "tiktok")
    .maybeSingle();

  if (!connection) throw new Error("TikTok not connected");
  const config = connection.config as { access_token: string };

  const res = await fetch(`${TIKTOK_API_BASE}/video/list/?fields=id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ max_count: 20 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("TikTok list videos error:", errText);
    throw new Error(`Failed to list videos (${res.status})`);
  }

  const data = await res.json();
  return jsonRes({ videos: data.data?.videos || [] });
}
