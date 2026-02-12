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
      platform: z.enum(["facebook", "instagram"]),
      message: z.string().min(1).max(63206),
      image_url: z.string().url().max(2000).optional(),
      post_id: z.string().uuid().optional(),
    });
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { platform, message, image_url, post_id } = parsed.data;

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

    const pageId = pages[0].id;

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
      result = await publishToInstagram(igAccounts[0].id, pageAccessToken, message, image_url);
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
