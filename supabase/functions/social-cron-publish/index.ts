import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // No auth gate needed — verify_jwt=false and this is a server-side cron function.
    // Use service role key for full DB access (bypasses RLS).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find all scheduled posts that are due
    const now = new Date().toISOString();
    console.log(`[social-cron-publish] Querying scheduled posts. Current UTC: ${now}`);

    const { data: duePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_date", now)
      .order("scheduled_date", { ascending: true })
      .limit(20);

    console.log(`[social-cron-publish] Query returned ${duePosts?.length ?? 0} posts, error: ${fetchError?.message ?? 'none'}`);

    if (fetchError) {
      console.error("Error fetching due posts:", fetchError);
      throw new Error("Failed to fetch scheduled posts");
    }

    // Fallback: auto-promote stuck draft posts that have qa_status=scheduled but status=draft
    const { data: stuckPosts } = await supabase
      .from("social_posts")
      .select("id, scheduled_date, platform")
      .eq("qa_status", "scheduled")
      .eq("status", "draft")
      .lte("scheduled_date", now)
      .limit(20);

    if (stuckPosts && stuckPosts.length > 0) {
      console.log(`[social-cron-publish] Found ${stuckPosts.length} stuck draft posts with qa_status=scheduled — promoting to scheduled`);
      for (const sp of stuckPosts) {
        console.log(`  Promoting stuck post ${sp.id}: platform=${sp.platform}, scheduled_date=${sp.scheduled_date}`);
        await supabase
          .from("social_posts")
          .update({ status: "scheduled" })
          .eq("id", sp.id);
      }
      // Re-fetch to include newly promoted posts
      const { data: refreshed } = await supabase
        .from("social_posts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_date", now)
        .order("scheduled_date", { ascending: true })
        .limit(20);
      if (refreshed && refreshed.length > 0) {
        duePosts.push(...refreshed.filter(r => !duePosts.some(d => d.id === r.id)));
      }
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts due for publishing", published: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${duePosts.length} posts due for publishing. Current UTC: ${now}`);
    for (const p of duePosts) {
      console.log(`  Post ${p.id}: platform=${p.platform}, scheduled_date=${p.scheduled_date}, status=${p.status}`);
    }

    const results: { postId: string; platform: string; success: boolean; error?: string }[] = [];

    for (const post of duePosts) {
      try {
        // Mark publish attempt to prevent retry storms
        await supabase
          .from("social_posts")
          .update({ status: "publishing" })
          .eq("id", post.id)
          .eq("status", "scheduled");

        const message = [
          post.content || "",
          (post.hashtags || []).length > 0 ? "\n\n" + (post.hashtags || []).join(" ") : "",
        ].join("");

        let publishResult: { id?: string; error?: string } = { error: "Unsupported platform" };

        if (post.platform === "facebook" || post.platform === "instagram") {
          // Get user token
          const tokenPlatform = post.platform === "instagram" ? "instagram" : "facebook";
          let tokenData = (await supabase
            .from("user_meta_tokens")
            .select("access_token, pages, instagram_accounts")
            .eq("user_id", post.user_id)
            .eq("platform", tokenPlatform)
            .maybeSingle()).data;

          // Fallback: if post owner has no token, use any team member's token
          if (!tokenData) {
            console.log(`[social-cron-publish] No ${tokenPlatform} token for post owner ${post.user_id}, trying fallback`);
            tokenData = (await supabase
              .from("user_meta_tokens")
              .select("access_token, pages, instagram_accounts, user_id")
              .eq("platform", tokenPlatform)
              .limit(1)
              .maybeSingle()).data;
            if (tokenData) {
              console.log(`[social-cron-publish] Using fallback token from user ${(tokenData as any).user_id}`);
            }
          }

          if (!tokenData) {
            publishResult = { error: `${post.platform} not connected for any user` };
          } else {
            const pages = (tokenData.pages as Array<{ id: string }>) || [];
            if (pages.length === 0) {
              publishResult = { error: "No Facebook Pages found" };
            } else {
              // Match page_name from the post to the correct page
              let selectedPage = pages[0] as { id: string; name?: string };
              if (post.page_name) {
                const matched = pages.find((p: { id: string; name?: string }) => p.name === post.page_name);
                if (matched) selectedPage = matched;
              }
              const pageId = selectedPage.id;
              const { data: pageTokenData } = await supabase
                .from("user_meta_tokens")
                .select("access_token")
                .eq("user_id", post.user_id)
                .eq("platform", `${tokenPlatform}_page_${pageId}`)
                .maybeSingle();
              const pageAccessToken = pageTokenData?.access_token || tokenData.access_token;

              if (post.platform === "facebook") {
                publishResult = await publishToFacebook(pageId, pageAccessToken, message, post.image_url);
              } else {
                const igAccounts = (tokenData.instagram_accounts as Array<{ id: string; pageId?: string }>) || [];
                if (igAccounts.length === 0) {
                  publishResult = { error: "No Instagram Business Account found" };
                } else {
                  // Match IG account to the selected Facebook page
                  const matchedIg = igAccounts.find(ig => ig.pageId === pageId) || igAccounts[0];
                  publishResult = await publishToInstagram(matchedIg.id, pageAccessToken, message, post.image_url);
                }
              }
            }
          }
        } else if (post.platform === "linkedin") {
          publishResult = await publishToLinkedIn(supabase, post.user_id, message, post.image_url);
        }

        if (publishResult.error) {
          await supabase.from("social_posts").update({ status: "failed", qa_status: "needs_review" }).eq("id", post.id);
          results.push({ postId: post.id, platform: post.platform, success: false, error: publishResult.error });
        } else {
          await supabase.from("social_posts").update({ status: "published", qa_status: "published" }).eq("id", post.id);
          results.push({ postId: post.id, platform: post.platform, success: true });
        }
      } catch (err) {
        console.error(`Failed to publish post ${post.id}:`, err);
        await supabase.from("social_posts").update({ status: "failed", qa_status: "needs_review" }).eq("id", post.id);
        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const published = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Cron publish complete: ${published} published, ${failed} failed`);

    return new Response(
      JSON.stringify({ published, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Social cron publish error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Publishing Functions ──────────────────────────────────────────

async function publishToFacebook(
  pageId: string, accessToken: string, message: string, imageUrl?: string | null
): Promise<{ id?: string; error?: string }> {
  try {
    const params: Record<string, string> = { access_token: accessToken };
    let url: string;
    if (imageUrl) {
      url = `${GRAPH_API}/${pageId}/photos`;
      params.url = imageUrl;
      params.message = message;
    } else {
      url = `${GRAPH_API}/${pageId}/feed`;
      params.message = message;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.error) return { error: `Facebook: ${data.error.message}` };
    return { id: data.id || data.post_id };
  } catch (err) {
    return { error: `Facebook: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

async function publishToInstagram(
  igAccountId: string, accessToken: string, caption: string, imageUrl?: string | null
): Promise<{ id?: string; error?: string }> {
  if (!imageUrl) return { error: "Instagram requires an image" };
  try {
    const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const containerData = await containerRes.json();
    if (containerData.error) return { error: `Instagram: ${containerData.error.message}` };

    // Poll for ready
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${GRAPH_API}/${containerData.id}?fields=status_code&access_token=${accessToken}`);
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
        });
        const publishData = await publishRes.json();
        if (publishData.error) return { error: `Instagram: ${publishData.error.message}` };
        return { id: publishData.id };
      }
      if (statusData.status_code === "ERROR") return { error: "Instagram media processing failed" };
    }
    return { error: "Instagram media processing timed out" };
  } catch (err) {
    return { error: `Instagram: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

async function publishToLinkedIn(
  supabase: ReturnType<typeof createClient>, userId: string, text: string, imageUrl?: string | null
): Promise<{ id?: string; error?: string }> {
  try {
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("integration_id", "linkedin")
      .maybeSingle();

    if (!connection) return { error: "LinkedIn not connected" };
    const config = connection.config as { access_token: string; expires_at: number };

    if (config.expires_at < Date.now()) return { error: "LinkedIn token expired" };

    // Get user URN
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

    // If image, register and upload
    if (imageUrl) {
      try {
        // Register upload
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
            // Download the image
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const imgBlob = await imgRes.blob();
              await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${config.access_token}`,
                  "Content-Type": imgBlob.type || "image/png",
                },
                body: imgBlob,
              });

              payload.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
              payload.specificContent["com.linkedin.ugc.ShareContent"].media = [{
                status: "READY",
                media: asset,
              }];
            }
          }
        }
      } catch (e) {
        console.error("LinkedIn image upload error (non-critical):", e);
        // Continue with text-only post
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
    return { error: `LinkedIn: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}
