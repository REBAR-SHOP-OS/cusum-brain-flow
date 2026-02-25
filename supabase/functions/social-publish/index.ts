import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

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

    const publishSchema = z.object({
      platform: z.enum(["facebook", "instagram", "linkedin", "twitter"]),
      message: z.string().min(1).max(63206),
      image_url: z.string().url().max(2000).optional(),
      post_id: z.string().uuid().optional(),
      page_name: z.string().optional(),
    });
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { platform, message, image_url, post_id, page_name } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user token for the platform
    const tokenPlatform = platform === "instagram" ? "instagram" : "facebook";
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("user_meta_tokens")
      .select("access_token, pages, instagram_accounts")
      .eq("user_id", userId)
      .eq("platform", tokenPlatform)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: `${platform} not connected. Please connect it first from Integrations.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pages = (tokenData.pages as Array<{ id: string; name: string }>) || [];
    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No Facebook Pages found. Make sure your account has at least one Page." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the correct page based on page_name, fallback to first page
    let selectedPage = pages[0];
    if (page_name) {
      const matched = pages.find((p) => p.name === page_name);
      if (matched) selectedPage = matched;
      else console.warn(`Page "${page_name}" not found among ${pages.map(p => p.name).join(", ")}. Falling back to first page.`);
    }
    const pageId = selectedPage.id;

    // Get page-specific access token
    const { data: pageTokenData } = await supabaseAdmin
      .from("user_meta_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("platform", `${tokenPlatform}_page_${pageId}`)
      .maybeSingle();

    const pageAccessToken = pageTokenData?.access_token || tokenData.access_token;

    let result: { id?: string; error?: string };

    if (platform === "facebook") {
      result = await publishToFacebook(pageId, pageAccessToken, message, image_url);
    } else if (platform === "instagram") {
      const igAccounts = (tokenData.instagram_accounts as Array<{ id: string; username: string; pageId: string }>) || [];
      if (igAccounts.length === 0) {
        return new Response(
          JSON.stringify({ error: "No Instagram Business Account found. Make sure your Facebook Page is linked to an Instagram Business Account." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Find the IG account linked to the selected page
      let selectedIg = igAccounts[0];
      const matchedIg = igAccounts.find((ig) => ig.pageId === pageId);
      if (matchedIg) selectedIg = matchedIg;
      else if (page_name) console.warn(`No IG account matched pageId ${pageId}. Using first: ${igAccounts[0].username}`);
      result = await publishToInstagram(selectedIg.id, pageAccessToken, message, image_url);
    } else if (platform === "linkedin") {
      result = await publishToLinkedIn(supabaseAdmin, userId, message, image_url);
    } else if (platform === "twitter") {
      result = await publishToTwitter(message, image_url);
    } else {
      return new Response(
        JSON.stringify({ error: `Publishing to ${platform} is not yet supported.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update post status to published if post_id provided
    if (post_id) {
      await supabaseAdmin
        .from("social_posts")
        .update({ status: "published" })
        .eq("id", post_id);
    }

    return new Response(
      JSON.stringify({ success: true, postId: result.id, platform }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Social publish error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  imageUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    let url: string;
    const params: Record<string, string> = { access_token: accessToken };

    if (imageUrl) {
      // Photo post
      url = `${GRAPH_API}/${pageId}/photos`;
      params.url = imageUrl;
      params.message = message;
    } else {
      // Text post
      url = `${GRAPH_API}/${pageId}/feed`;
      params.message = message;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (data.error) {
      console.error("Facebook API error:", data.error);
      return { error: `Facebook: ${data.error.message}` };
    }

    return { id: data.id || data.post_id };
  } catch (err) {
    return { error: `Facebook publish failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    if (!imageUrl) {
      return { error: "Instagram requires an image to publish. Please add an image to your post." };
    }

    // Step 1: Create media container
    const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (containerData.error) {
      console.error("Instagram container error:", containerData.error);
      return { error: `Instagram: ${containerData.error.message}` };
    }

    const containerId = containerData.id;

    // Step 2: Wait for container to be ready (poll status)
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (statusData.status_code === "ERROR") {
        return { error: "Instagram media processing failed. Try a different image." };
      }
    }

    if (!ready) {
      return { error: "Instagram media processing timed out. Try again." };
    }

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (publishData.error) {
      console.error("Instagram publish error:", publishData.error);
      return { error: `Instagram: ${publishData.error.message}` };
    }

    return { id: publishData.id };
  } catch (err) {
    return { error: `Instagram publish failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

async function publishToLinkedIn(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  text: string,
  imageUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("integration_id", "linkedin")
      .maybeSingle();

    if (!connection) return { error: "LinkedIn not connected. Please connect it from Integrations." };
    const config = connection.config as { access_token: string; expires_at: number };

    if (config.expires_at < Date.now()) return { error: "LinkedIn token expired. Please reconnect." };

    // Get LinkedIn user URN
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${config.access_token}` },
    });
    if (!profileRes.ok) return { error: "Failed to get LinkedIn identity" };
    const profile = await profileRes.json();

    const payload: any = {
      author: `urn:li:person:${profile.sub}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    // Handle image upload to LinkedIn if provided
    if (imageUrl) {
      try {
        const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: `urn:li:person:${profile.sub}`,
              serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
            },
          }),
        });

        if (registerRes.ok) {
          const registerData = await registerRes.json();
          const uploadUrl = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
          const asset = registerData.value?.asset;

          if (uploadUrl && asset) {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const imgBlob = await imgRes.blob();
              await fetch(uploadUrl, {
                method: "PUT",
                headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": imgBlob.type || "image/png" },
                body: imgBlob,
              });
              payload.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
              payload.specificContent["com.linkedin.ugc.ShareContent"].media = [{ status: "READY", media: asset }];
            }
          }
        }
      } catch (e) {
        console.error("LinkedIn image upload error:", e);
      }
    }

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
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
      return { error: `LinkedIn API error (${postRes.status})` };
    }

    return { id: postRes.headers.get("x-restli-id") || "published" };
  } catch (err) {
    return { error: `LinkedIn publish failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

// ─── Twitter/X Publishing ───────────────────────────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function createOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
  extraParams?: Record<string, string>
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // For signature: only include OAuth params (NOT POST body params for JSON requests)
  const allParams = { ...oauthParams, ...(extraParams || {}) };
  const paramStr = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const baseStr = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramStr)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseStr);

  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

async function publishToTwitter(
  text: string,
  imageUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      return { error: "Twitter API credentials not configured. Please add TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET." };
    }

    let mediaId: string | undefined;

    // Upload media if image provided
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          const imgBuffer = new Uint8Array(await imgBlob.arrayBuffer());
          const base64 = btoa(String.fromCharCode(...imgBuffer));

          const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
          const uploadParams = {
            media_data: base64,
            media_category: "tweet_image",
          };

          const formBody = Object.entries(uploadParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");

          const uploadAuth = await createOAuthHeader(
            "POST", uploadUrl, consumerKey, consumerSecret, accessToken, accessTokenSecret
          );

          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              Authorization: uploadAuth,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formBody,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            mediaId = uploadData.media_id_string;
          } else {
            console.error("Twitter media upload failed:", await uploadRes.text());
          }
        }
      } catch (e) {
        console.error("Twitter image upload error:", e);
      }
    }

    // Post tweet
    const tweetUrl = "https://api.x.com/2/tweets";
    const tweetBody: any = { text };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

    // Do NOT include POST body params in OAuth signature for JSON requests
    const authHeader = await createOAuthHeader(
      "POST", tweetUrl, consumerKey, consumerSecret, accessToken, accessTokenSecret
    );

    const tweetRes = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData = await tweetRes.json();
    if (!tweetRes.ok) {
      console.error("Twitter API error:", tweetData);
      return { error: `Twitter: ${tweetData.detail || tweetData.title || "Unknown error"}` };
    }

    return { id: tweetData.data?.id };
  } catch (err) {
    return { error: `Twitter publish failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}
