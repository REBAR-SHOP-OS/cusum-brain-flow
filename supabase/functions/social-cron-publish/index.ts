import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { acquirePublishLock, releasePublishLock, recoverStaleLocks, normalizePageName } from "../_shared/publishLock.ts";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Refresh a Facebook Page token using the user's long-lived token.
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
  // Strip any remaining Persian/Arabic characters as safety net
  t = t.split("\n").filter(l => !/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(l)).join("\n");
  return t.trim();
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase }) => {

    const now = new Date().toISOString();
    console.log(`[social-cron-publish] Querying scheduled posts. Current UTC: ${now}`);

    // Recovery: reset posts stuck in "publishing" for >10 minutes to "failed" (NOT "scheduled")
    const recovered = await recoverStaleLocks(supabase);
    const recoveredSet = new Set(recovered);
    if (recovered.length > 0) {
      console.log(`[social-cron-publish] Recovered ${recovered.length} stale publishing posts to FAILED: ${recovered.join(", ")}`);
    }

    const { data: rawDuePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .eq("neel_approved", true)
      .lte("scheduled_date", now)
      .order("scheduled_date", { ascending: true })
      .limit(20);

    // Defense-in-depth: exclude any just-recovered posts in case status update hasn't propagated
    const duePosts = (rawDuePosts || []).filter(p => !recoveredSet.has(p.id));

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
      console.log(`[social-cron-publish] Found ${overduePosts.length} overdue unapproved posts — marking as failed`);
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
        duePosts!.push(...refreshed.filter(r => !duePosts!.some(d => d.id === r.id)));
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

    const results: { postId: string; platform: string; success: boolean; error?: string; pages?: string[] }[] = [];
    const SUPPORTED_PLATFORMS = ["facebook", "instagram", "linkedin"];

    for (const post of duePosts) {
      if (!SUPPORTED_PLATFORMS.includes(post.platform)) {
        console.log(`[social-cron-publish] Skipping ${post.id} — platform "${post.platform}" not yet supported`);
        results.push({ postId: post.id, platform: post.platform, success: false, error: "Platform not yet supported" });
        continue;
      }

      try {
        // ── Atomic Lock ──────────────────────────────────────────────
        const lock = await acquirePublishLock(supabase, post.id, ["scheduled"]);
        if (!lock.locked) {
          console.log(`[social-cron-publish] Skipping ${post.id} — ${lock.reason}`);
          continue;
        }
        const lockId = lock.lockId!;
        console.log(`[social-cron-publish] Acquired lock for post ${post.id}: lockId=${lockId}`);

        // ── Enhanced Duplicate Guard ─────────────────────────────────
        const dayStr = post.scheduled_date
          ? new Date(post.scheduled_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        const { data: publishedToday } = await supabase
          .from("social_posts")
          .select("id, title, content, image_url, page_name")
          .eq("platform", post.platform)
          .eq("status", "published")
          .neq("id", post.id)
          .gte("scheduled_date", `${dayStr}T00:00:00Z`)
          .lte("scheduled_date", `${dayStr}T23:59:59Z`)
          .limit(50);

        const individualPages = post.page_name
          ? post.page_name.split(", ").map((p: string) => p.trim()).filter(Boolean)
          : [];

        let isDuplicate = false;
        if (publishedToday && publishedToday.length > 0) {
          for (const pub of publishedToday) {
            const sameContent = pub.content === post.content && pub.image_url === post.image_url;
            const sameTitle = pub.title && post.title && pub.title === post.title;

            if (sameContent || sameTitle) {
              const pubPages = pub.page_name
                ? pub.page_name.split(", ").map((p: string) => p.trim()).filter(Boolean)
                : [];
              const hasPageOverlap = individualPages.length === 0 || pubPages.length === 0
                || individualPages.some((pg: string) => pubPages.includes(pg));

              if (hasPageOverlap) {
                isDuplicate = true;
                console.warn(`[social-cron-publish] Duplicate detected: post ${post.id} matches published ${pub.id}`);
                break;
              }
            }
          }
        }

        if (isDuplicate) {
          await releasePublishLock(supabase, post.id, lockId, "failed", { last_error: "Duplicate — same content already published today" });
          results.push({ postId: post.id, platform: post.platform, success: false, error: "Duplicate content already published" });
          continue;
        }

        // Strip Persian translation block
        const cleanContent = stripPersianBlock(post.content || "");
        const contentHasHashtags = /#[a-zA-Z]\w/.test(cleanContent);
        const message = contentHasHashtags
          ? cleanContent
          : [cleanContent, (post.hashtags || []).length > 0 ? "\n\n" + (post.hashtags || []).join(" ") : ""].join("");

        // ── Multi-Page Publishing Loop ───────────────────────────────
        const pageErrors: string[] = [];
        const pageSuccesses: string[] = [];

        if (post.platform === "facebook" || post.platform === "instagram") {
          const tokenPlatform = post.platform === "instagram" ? "instagram" : "facebook";

          // OWNER-FIRST: try post owner's token, then fall back to same-company teammate
          let tokenData = (await supabase
            .from("user_meta_tokens")
            .select("access_token, pages, instagram_accounts, user_id")
            .eq("user_id", post.user_id)
            .eq("platform", tokenPlatform)
            .maybeSingle()).data;

          let tokenOwnerUserId = post.user_id;

          if (!tokenData) {
            // Team fallback: find a teammate in the same company with a valid token
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("company_id")
              .eq("user_id", post.user_id)
              .maybeSingle();

            if (ownerProfile?.company_id) {
              const { data: teammates } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("company_id", ownerProfile.company_id)
                .neq("user_id", post.user_id);

              if (teammates && teammates.length > 0) {
                for (const tm of teammates) {
                  const { data: tmToken } = await supabase
                    .from("user_meta_tokens")
                    .select("access_token, pages, instagram_accounts, user_id")
                    .eq("user_id", tm.user_id)
                    .eq("platform", tokenPlatform)
                    .maybeSingle();
                  if (tmToken && tmToken.access_token) {
                    tokenData = tmToken;
                    tokenOwnerUserId = tm.user_id;
                    console.log(`[social-cron-publish] Team fallback: using ${tokenPlatform} token from user ${tm.user_id} for post ${post.id}`);
                    break;
                  }
                }
              }
            }

            if (!tokenData) {
              const errMsg = `${post.platform} not connected for post owner or any teammate. Please connect ${post.platform} from Integrations.`;
              console.error(`[social-cron-publish] ${errMsg}`);
              await releasePublishLock(supabase, post.id, lockId, "failed", { last_error: errMsg, qa_status: "needs_review" });
              results.push({ postId: post.id, platform: post.platform, success: false, error: errMsg });
              continue;
            }
          }

          const pages = (tokenData.pages as Array<{ id: string; name?: string }>) || [];
          if (pages.length === 0) {
            const errMsg = "No Facebook Pages found in token data";
            await releasePublishLock(supabase, post.id, lockId, "failed", { last_error: errMsg, qa_status: "needs_review" });
            results.push({ postId: post.id, platform: post.platform, success: false, error: errMsg });
            continue;
          }

          // NO FALLBACK: if no pages assigned, fail explicitly
          if (individualPages.length === 0) {
            const errMsg = "No pages assigned to post (page_name is empty). Cannot publish without explicit page assignment.";
            console.error(`[social-cron-publish] FAIL post ${post.id}: ${errMsg}`);
            await releasePublishLock(supabase, post.id, lockId, "failed", { last_error: errMsg, qa_status: "needs_review" });
            results.push({ postId: post.id, platform: post.platform, success: false, error: errMsg });
            continue;
          }

          console.log(`[social-cron-publish] Post ${post.id}: target_pages=[${individualPages.join(", ")}], available_pages=[${pages.map(p => p.name).join(", ")}]`);

          const publishedFbPageIds = new Set<string>();
          const publishedIgIds = new Set<string>();
          const igPublishQueue: Array<{ igAccountId: string; pageAccessToken: string; targetPageName: string }> = [];

          for (const targetPageName of individualPages) {
            if (!targetPageName) {
              pageErrors.push("Empty page name — skipped");
              continue;
            }

            // Normalized matching: case-insensitive + trim
            const normalizedTarget = normalizePageName(targetPageName);
            const selectedPage = pages.find((p) => normalizePageName(p.name || "") === normalizedTarget);
            if (!selectedPage) {
              console.warn(`[social-cron-publish] SKIP — page "${targetPageName}" not found in token pages [${pages.map(p => p.name).join(", ")}]. Will NOT fall back.`);
              pageErrors.push(`Page "${targetPageName}": not found in connected pages — skipped`);
              continue;
            }
            const pageId = selectedPage.id;

            // Get page-specific access token (use token owner, not post owner)
            const { data: pageTokenData } = await supabase
              .from("user_meta_tokens")
              .select("access_token")
              .eq("user_id", tokenOwnerUserId)
              .eq("platform", `${tokenPlatform}_page_${pageId}`)
              .maybeSingle();
            let pageAccessToken = pageTokenData?.access_token || tokenData.access_token;

            let publishResult: { id?: string; error?: string } = { error: "Unsupported platform" };

            if (post.platform === "facebook") {
              // Refresh page token
              const refreshedToken = await refreshPageToken(tokenData.access_token, pageId);
              if (refreshedToken) {
                pageAccessToken = refreshedToken;
                await supabase
                  .from("user_meta_tokens")
                  .upsert({
                    user_id: tokenOwnerUserId,
                    platform: `facebook_page_${pageId}`,
                    access_token: refreshedToken,
                  }, { onConflict: "user_id,platform" });
              }

              // Pre-flight: verify page token validity
              const preflightRes = await fetch(`${GRAPH_API}/${pageId}?fields=id,name&access_token=${pageAccessToken}`);
              const preflightData = await preflightRes.json();
              if (preflightData.error) {
                console.error(`[social-cron-publish] Facebook pre-flight failed for page "${targetPageName}":`, preflightData.error);
                pageErrors.push(`Page "${targetPageName}": ${preflightData.error.message || "Token invalid"}`);
                continue;
              }

              // Verify permissions
              try {
                const permRes = await fetch(`${GRAPH_API}/me/permissions?access_token=${pageAccessToken}`);
                const permData = await permRes.json();
                if (permData.data && Array.isArray(permData.data)) {
                  const managePostsPerm = permData.data.find((p: any) => p.permission === "pages_manage_posts");
                  if (!managePostsPerm || managePostsPerm.status !== "granted") {
                    pageErrors.push(`Page "${targetPageName}": Missing pages_manage_posts permission`);
                    continue;
                  }
                }
              } catch (permErr) {
                console.warn(`[social-cron-publish] Permission check failed for page "${targetPageName}", proceeding:`, permErr);
              }

              if (publishedFbPageIds.has(pageId)) {
                console.log(`[social-cron-publish] Skipping page "${targetPageName}" — FB page ${pageId} already published`);
                pageSuccesses.push(targetPageName);
                continue;
              }
              publishedFbPageIds.add(pageId);

              publishResult = await publishToFacebook(pageId, pageAccessToken, message, post.image_url);

              // NO text-only fallback — if image publish fails, propagate the error
              if (publishResult.error && post.image_url) {
                console.error(`[social-cron-publish] Facebook image publish failed for page "${targetPageName}" — will NOT retry without image. Error: ${publishResult.error}`);
              }
            } else {
              // Instagram — collect for parallel publishing below
              const refreshedToken = await refreshPageToken(tokenData.access_token, pageId);
              if (refreshedToken) {
                pageAccessToken = refreshedToken;
                await supabase
                  .from("user_meta_tokens")
                  .upsert({
                    user_id: tokenOwnerUserId,
                    platform: `instagram_page_${pageId}`,
                    access_token: refreshedToken,
                  }, { onConflict: "user_id,platform" });
                console.log(`[social-cron-publish] Refreshed page token for IG (page ${pageId})`);
              }

              const igAccounts = (tokenData.instagram_accounts as Array<{ id: string; pageId?: string; username?: string }>) || [];
              console.log(`[social-cron-publish] IG accounts available: [${igAccounts.map(ig => `${ig.id}(page=${ig.pageId})`).join(", ")}]`);
              if (igAccounts.length === 0) {
                pageErrors.push(`Page "${targetPageName}": No Instagram Business Account found`);
                continue;
              }
              const matchedIg = igAccounts.find(ig => ig.pageId === pageId);
              if (!matchedIg) {
                console.warn(`[social-cron-publish] SKIP — no IG account linked to FB page ${pageId} ("${targetPageName}")`);
                pageErrors.push(`Page "${targetPageName}": no linked Instagram account — skipped`);
                continue;
              }
              console.log(`[social-cron-publish] Matched IG account: id=${matchedIg.id}, username=${(matchedIg as any).username || "unknown"}, for page "${targetPageName}"`);
              if (publishedIgIds.has(matchedIg.id)) {
                console.log(`[social-cron-publish] Skipping page "${targetPageName}" — IG account ${matchedIg.id} already published`);
                pageSuccesses.push(targetPageName);
                continue;
              }
              publishedIgIds.add(matchedIg.id);
              igPublishQueue.push({ igAccountId: matchedIg.id, pageAccessToken, targetPageName });
              continue;
            }

            if (publishResult.error) {
              console.error(`[social-cron-publish] Failed to publish to page "${targetPageName}": ${publishResult.error}`);
              pageErrors.push(`Page "${targetPageName}": ${publishResult.error}`);
            } else {
              console.log(`[social-cron-publish] Published to page "${targetPageName}" successfully (id: ${publishResult.id})`);
              pageSuccesses.push(targetPageName);
            }
          }

          // --- Parallel Instagram publishing ---
          if (igPublishQueue.length > 0) {
            console.log(`[social-cron-publish] Publishing to ${igPublishQueue.length} IG accounts in parallel`);
            const igResults = await Promise.allSettled(
              igPublishQueue.map(({ igAccountId, pageAccessToken: pat, targetPageName: tpn }) =>
                publishToInstagram(igAccountId, pat, message, post.image_url, post.content_type || "post", post.cover_image_url)
                  .then(r => ({ ...r, targetPageName: tpn }))
                  .catch(e => ({ error: e?.message || String(e), targetPageName: tpn }))
              )
            );
            for (const settled of igResults) {
              const r = settled.status === "fulfilled" ? settled.value : { error: (settled.reason?.message || String(settled.reason)), targetPageName: "unknown" };
              if (r.error) {
                console.error(`[social-cron-publish] IG parallel failed on "${r.targetPageName}": ${r.error}`);
                pageErrors.push(`Page "${r.targetPageName}": ${r.error}`);
              } else {
                console.log(`[social-cron-publish] IG parallel published to "${r.targetPageName}" (id: ${(r as any).id})`);
                pageSuccesses.push(r.targetPageName);
              }
            }
          }
        } else if (post.platform === "linkedin") {
          // OWNER-ONLY for LinkedIn too
          const publishResult = await publishToLinkedIn(supabase, post.user_id, message, post.image_url, true);
          if (publishResult.error) {
            pageErrors.push(publishResult.error);
          } else {
            pageSuccesses.push("linkedin");
          }
        }

        // Determine final status based on per-page results
        if (pageSuccesses.length > 0) {
          const partialError = pageErrors.length > 0 ? ` (failed on: ${pageErrors.join("; ")})` : "";
          await releasePublishLock(supabase, post.id, lockId, "published", {
            qa_status: "published",
            ...(partialError ? { last_error: partialError } : {}),
          });
          results.push({ postId: post.id, platform: post.platform, success: true, pages: pageSuccesses });
          if (pageErrors.length > 0) {
            console.warn(`[social-cron-publish] Post ${post.id} partially published. Successes: [${pageSuccesses.join(", ")}], Failures: [${pageErrors.join("; ")}]`);
          }
        } else {
          const errMsg = pageErrors.join("; ") || "Unknown publishing error";
          console.error(`[social-cron-publish] FINAL FAILURE for post ${post.id}: ${errMsg}`);
          await releasePublishLock(supabase, post.id, lockId, "failed", { last_error: errMsg, qa_status: "needs_review" });
          results.push({ postId: post.id, platform: post.platform, success: false, error: errMsg });
        }
      } catch (err) {
        console.error(`Failed to publish post ${post.id}:`, err);
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        // Try to release lock if we have one — but we might not
        await supabase.from("social_posts").update({
          status: "failed", qa_status: "needs_review", last_error: errMsg,
          publishing_lock_id: null, publishing_started_at: null,
        }).eq("id", post.id);
        results.push({ postId: post.id, platform: post.platform, success: false, error: errMsg });
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
  igAccountId: string, accessToken: string, caption: string, imageUrl?: string | null,
  contentType: string = "post", coverImageUrl?: string | null
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

    const isStory = contentType === "story";

    const containerBody: Record<string, string> = {
      access_token: accessToken,
    };

    if (isStory) {
      containerBody.media_type = "STORIES";
      if (isVideo) {
        containerBody.video_url = imageUrl;
      } else {
        containerBody.image_url = imageUrl;
      }
      console.log(`[cron-IG] Publishing Instagram Story (video=${isVideo})`);
    } else if (isVideo) {
      containerBody.media_type = "REELS";
      containerBody.video_url = imageUrl;
      containerBody.caption = caption;
      if (coverImageUrl) {
        containerBody.cover_url = coverImageUrl;
        console.log(`[cron-IG] Using cover image for reel: ${coverImageUrl.substring(0, 60)}…`);
      }
    } else {
      containerBody.image_url = imageUrl;
      containerBody.caption = caption;
    }

    console.log(`[cron-IG] Creating container for IG account ${igAccountId}, media_type=${containerBody.media_type || "IMAGE"}`);

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

    const containerId = containerData.id;
    console.log(`[cron-IG] Container created: ${containerId}`);

    // Poll for ready — videos need much longer
    const maxPolls = isVideo ? 30 : 20;
    const pollInterval = isVideo ? 3000 : 2000;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const statusRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`);
      const statusData = await statusRes.json();
      console.log(`[cron-IG] Poll ${i + 1}/${maxPolls}: status=${statusData.status_code}, raw=${JSON.stringify(statusData)}`);

      if (statusData.error) {
        console.error(`[cron-IG] Poll error: ${statusData.error.message}`);
        return { error: `Instagram polling error: ${statusData.error.message}` };
      }

      if (statusData.status_code === "FINISHED") {
        const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
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
  supabase: ReturnType<typeof createClient>, userId: string, text: string,
  imageUrl?: string | null, ownerOnly: boolean = false
): Promise<{ id?: string; error?: string }> {
  try {
    let { data: connection } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("integration_id", "linkedin")
      .maybeSingle();

    // OWNER-ONLY: no team fallback when ownerOnly is true
    if (!connection && !ownerOnly) {
      const { data: fallback } = await supabase
        .from("integration_connections")
        .select("config")
        .eq("integration_id", "linkedin")
        .eq("status", "connected")
        .order("last_sync_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      connection = fallback;
    }

    if (!connection) return { error: ownerOnly ? `LinkedIn not connected for post owner (${userId}). Owner-only token policy.` : "LinkedIn not connected" };
    const config = connection.config as { access_token: string; expires_at: number };

    if (config.expires_at < Date.now()) return { error: "LinkedIn token expired — please reconnect LinkedIn in Settings → Integrations" };

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
