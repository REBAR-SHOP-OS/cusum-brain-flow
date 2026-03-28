import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Refresh a Facebook Page token using the user's long-lived token.
 * Returns a fresh page access token with current permissions, or null on failure.
 */
async function refreshPageToken(
  userLongLivedToken: string,
  pageId: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${pageId}?fields=access_token&access_token=${userLongLivedToken}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        console.log(`[social-cron-publish] Refreshed page token for page ${pageId}`);
        return data.access_token;
      }
    } else {
      const errBody = await res.text();
      console.warn(`[social-cron-publish] Page token refresh failed (${res.status}): ${errBody}`);
    }
  } catch (e) {
    console.warn(`[social-cron-publish] Page token refresh exception:`, e);
  }
  return null;
}

/** Strip Persian translation block — never publish Persian text */
function stripPersianBlock(text: string): string {
  let t = text;
  const idx = t.indexOf("---PERSIAN---");
  if (idx !== -1) t = t.slice(0, idx);
  t = t.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
  t = t.replace(/📝\s*ترجمه کپشن:[\s\S]*/m, "");
  return t.trim();
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase }) => {

    // Find all scheduled posts that are due
    const now = new Date().toISOString();
    console.log(`[social-cron-publish] Querying scheduled posts. Current UTC: ${now}`);

    // Recovery: reset posts stuck in "publishing" for >10 minutes back to "scheduled"
    const { data: stalePublishing } = await supabase
      .from("social_posts")
      .update({ status: "scheduled" })
      .eq("status", "publishing")
      .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .select("id");
    if (stalePublishing && stalePublishing.length > 0) {
      console.log(`[social-cron-publish] Recovered ${stalePublishing.length} stale publishing posts: ${stalePublishing.map(p => p.id).join(", ")}`);
    }

    const { data: duePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .eq("neel_approved", true)
      .lte("scheduled_date", now)
      .order("scheduled_date", { ascending: true })
      .limit(20);

    console.log(`[social-cron-publish] Query returned ${duePosts?.length ?? 0} approved posts, error: ${fetchError?.message ?? 'none'}`);

    // Flag overdue unapproved posts as failed — do NOT auto-approve
    const midnightCutoff = new Date();
    midnightCutoff.setUTCHours(0, 0, 0, 0);

    const { data: overduePosts } = await supabase
      .from("social_posts")
      .select("id, platform, scheduled_date")
      .eq("status", "scheduled")
      .eq("neel_approved", false)
      .lt("scheduled_date", midnightCutoff.toISOString())
      .order("scheduled_date", { ascending: true })
      .limit(20);

    if (overduePosts && overduePosts.length > 0) {
      console.log(`[social-cron-publish] Found ${overduePosts.length} overdue unapproved posts — marking as failed (approval deadline passed)`);
      for (const op of overduePosts) {
        console.log(`[social-cron-publish] Failing overdue post ${op.id}: platform=${op.platform}, scheduled_date=${op.scheduled_date}`);
        await supabase
          .from("social_posts")
          .update({ status: "failed", qa_status: "needs_review", last_error: "Approval deadline passed — not approved by Neel/Sattar" })
          .eq("id", op.id);
      }
    }

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
        .eq("neel_approved", true)
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

    const SUPPORTED_PLATFORMS = ["facebook", "instagram", "linkedin"];

    for (const post of duePosts) {
      // Skip unsupported platforms — leave as scheduled, don't mark failed
      if (!SUPPORTED_PLATFORMS.includes(post.platform)) {
        console.log(`[social-cron-publish] Skipping ${post.id} — platform "${post.platform}" not yet supported`);
        results.push({ postId: post.id, platform: post.platform, success: false, error: "Platform not yet supported" });
        continue;
      }

      try {
        // Guard: re-check status to prevent duplicate publishing (race condition with manual publish)
        const { data: freshPost } = await supabase
          .from("social_posts")
          .select("status")
          .eq("id", post.id)
          .single();
        if (["published", "publishing", "declined", "failed"].includes(freshPost?.status)) {
          console.log(`[social-cron-publish] Skipping ${post.id} — status is ${freshPost.status}`);
          continue;
        }

        // Mark publish attempt to prevent retry storms
        await supabase
          .from("social_posts")
          .update({ status: "publishing" })
          .eq("id", post.id)
          .eq("status", "scheduled");

        // Strip Persian translation block — never publish Persian text
        const cleanContent = stripPersianBlock(post.content || "");
        const contentHasHashtags = /#[a-zA-Z]\w/.test(cleanContent);
        const message = contentHasHashtags
          ? cleanContent
          : [cleanContent, (post.hashtags || []).length > 0 ? "\n\n" + (post.hashtags || []).join(" ") : ""].join("");

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
              let pageTokenData = (await supabase
                .from("user_meta_tokens")
                .select("access_token")
                .eq("user_id", post.user_id)
                .eq("platform", `${tokenPlatform}_page_${pageId}`)
                .maybeSingle()).data;
              // Fallback: try any user's page token
              if (!pageTokenData) {
                pageTokenData = (await supabase
                  .from("user_meta_tokens")
                  .select("access_token")
                  .eq("platform", `${tokenPlatform}_page_${pageId}`)
                  .limit(1)
                  .maybeSingle()).data;
              }
              let pageAccessToken = pageTokenData?.access_token || tokenData.access_token;

              if (post.platform === "facebook") {
                // Refresh page token using user's long-lived token for current permissions
                const userLLT = tokenData.access_token;
                const refreshedToken = await refreshPageToken(userLLT, pageId);
                if (refreshedToken) {
                  pageAccessToken = refreshedToken;
                  // Persist refreshed token
                  await supabase
                    .from("user_meta_tokens")
                    .upsert({
                      user_id: post.user_id,
                      platform: `facebook_page_${pageId}`,
                      access_token: refreshedToken,
                    }, { onConflict: "user_id,platform" });
                } else {
                  console.warn(`[social-cron-publish] Token refresh failed for post ${post.id}, using stored token`);
                }

                // Pre-flight: verify page token validity
                const preflightRes = await fetch(`${GRAPH_API}/${pageId}?fields=id,name&access_token=${pageAccessToken}`);
                const preflightData = await preflightRes.json();
                if (preflightData.error) {
                  console.error(`[social-cron-publish] Facebook pre-flight failed for post ${post.id}:`, preflightData.error);
                  publishResult = { error: `Facebook permissions error: ${preflightData.error.message || "Token invalid"}. Reconnect Facebook with pages_read_engagement and pages_manage_posts.` };
                } else {
                  // Verify pages_manage_posts permission before publishing
                  try {
                    const permRes = await fetch(`${GRAPH_API}/me/permissions?access_token=${pageAccessToken}`);
                    const permData = await permRes.json();
                    if (permData.data && Array.isArray(permData.data)) {
                      const managePostsPerm = permData.data.find((p: any) => p.permission === "pages_manage_posts");
                      if (!managePostsPerm || managePostsPerm.status !== "granted") {
                        publishResult = { error: "Facebook App does not have 'pages_manage_posts' permission approved. Add this user as a Tester in Meta Developer Console, or submit for App Review." };
                      }
                    }
                  } catch (permErr) {
                    console.warn(`[social-cron-publish] Permission check failed for post ${post.id}, proceeding:`, permErr);
                  }
                  if (!publishResult.error) {
                    publishResult = await publishToFacebook(pageId, pageAccessToken, message, post.image_url);
                  }
                }
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

        // Image fallback: if publish with image failed, retry text-only
        if (publishResult.error && post.image_url && (post.platform === "facebook" || post.platform === "linkedin")) {
          console.error(`[social-cron-publish] Image publish failed for ${post.id}: ${publishResult.error}. Retrying text-only...`);
          if (post.platform === "facebook") {
            // Re-derive pageId and token for text-only retry
            const tokenPlatform = "facebook";
            let tokenData2 = (await supabase.from("user_meta_tokens").select("access_token, pages").eq("user_id", post.user_id).eq("platform", tokenPlatform).maybeSingle()).data;
            if (!tokenData2) tokenData2 = (await supabase.from("user_meta_tokens").select("access_token, pages, user_id").eq("platform", tokenPlatform).limit(1).maybeSingle()).data;
            if (tokenData2) {
              const pages2 = (tokenData2.pages as Array<{ id: string; name?: string }>) || [];
              let selectedPage2 = pages2[0];
              if (post.page_name) { const m = pages2.find(p => p.name === post.page_name); if (m) selectedPage2 = m; }
              if (selectedPage2) {
                let pt2 = (await supabase.from("user_meta_tokens").select("access_token").eq("user_id", post.user_id).eq("platform", `${tokenPlatform}_page_${selectedPage2.id}`).maybeSingle()).data;
                if (!pt2) pt2 = (await supabase.from("user_meta_tokens").select("access_token").eq("platform", `${tokenPlatform}_page_${selectedPage2.id}`).limit(1).maybeSingle()).data;
                const pat2 = pt2?.access_token || tokenData2.access_token;
                publishResult = await publishToFacebook(selectedPage2.id, pat2, message, null);
              }
            }
          }
        }

        if (publishResult.error) {
          console.error(`[social-cron-publish] FINAL FAILURE for post ${post.id}: ${publishResult.error}`);
          await supabase.from("social_posts").update({ status: "failed", qa_status: "needs_review", last_error: publishResult.error }).eq("id", post.id);
          results.push({ postId: post.id, platform: post.platform, success: false, error: publishResult.error });
        } else {
          await supabase.from("social_posts").update({ status: "published", qa_status: "published" }).eq("id", post.id);
          results.push({ postId: post.id, platform: post.platform, success: true });
        }
      } catch (err) {
        console.error(`Failed to publish post ${post.id}:`, err);
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("social_posts").update({ status: "failed", qa_status: "needs_review", last_error: errMsg }).eq("id", post.id);
        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: errMsg,
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
  }, { functionName: "social-cron-publish", authMode: "none", requireCompany: false, wrapResult: false })
);

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
    // Detect video content
    let isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
    if (!isVideo) {
      try {
        const head = await fetch(imageUrl, { method: "HEAD" });
        const ct = head.headers.get("content-type") || "";
        isVideo = ct.startsWith("video/");
      } catch { /* ignore HEAD failures */ }
    }

    const containerBody: Record<string, string> = {
      caption,
      access_token: accessToken,
    };
    if (isVideo) {
      containerBody.media_type = "REELS";
      containerBody.video_url = imageUrl;
    } else {
      containerBody.image_url = imageUrl;
    }

    const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });
    const containerData = await containerRes.json();
    if (containerData.error) {
      console.error("[cron-IG] container error:", containerData.error);
      return { error: `Instagram: ${containerData.error.message}` };
    }

    // Poll for ready — videos need much longer
    const maxPolls = isVideo ? 30 : 10;
    const pollInterval = isVideo ? 3000 : 2000;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const statusRes = await fetch(`${GRAPH_API}/${containerData.id}?fields=status_code&access_token=${accessToken}`);
      const statusData = await statusRes.json();
      console.log(`[cron-IG] Poll ${i + 1}/${maxPolls}: status=${statusData.status_code}`);
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
    return { error: `Instagram media processing timed out after ${maxPolls * pollInterval / 1000}s. Try again.` };
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
