import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { acquirePublishLock, releasePublishLock, normalizePageName } from "../_shared/publishLock.ts";

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
        console.log(`[social-publish] Refreshed page token for page ${pageId}`);
        return data.access_token;
      }
    } else {
      const errBody = await res.text();
      console.warn(`[social-publish] Page token refresh failed (${res.status}): ${errBody}`);
    }
  } catch (e) {
    console.warn(`[social-publish] Page token refresh exception:`, e);
  }
  return null;
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: supabaseAdmin, body, req: rawReq }) => {

    const publishSchema = z.object({
      platform: z.enum(["facebook", "instagram", "linkedin", "twitter"]),
      message: z.string().max(63206).optional().default(""),
      image_url: z.string().url().max(2000).optional(),
      post_id: z.string().uuid().optional(),
      page_name: z.string().optional(),
      force_publish: z.boolean().optional(),
      content_type: z.enum(["post", "reel", "story"]).optional().default("post"),
      cover_image_url: z.string().url().max(2000).optional(),
    });
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { platform, message: rawMessage, image_url, post_id, page_name, force_publish, content_type, cover_image_url } = parsed.data;
    console.log(`[social-publish] Received: platform=${platform}, content_type=${content_type}, post_id=${post_id}`);

    let message = rawMessage;

    // Load the full post record for duplicate checking and multi-page publishing
    let postRecord: any = null;
    if (post_id) {
      const { data: existing } = await supabaseAdmin
        .from("social_posts")
        .select("status, neel_approved, declined_by, title, platform, page_name, scheduled_date, content, image_url")
        .eq("id", post_id)
        .maybeSingle();
      postRecord = existing;

      if (existing?.status === "published") {
        return new Response(
          JSON.stringify({ error: "This post has already been published." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing?.status === "publishing") {
        return new Response(
          JSON.stringify({ error: "This post is currently being published. Please wait." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // HARD GATE: declined posts can NEVER be published
      if (existing?.status === "declined") {
        console.warn(`[social-publish] BLOCKED — post ${post_id} was declined by ${existing.declined_by}`);
        return new Response(
          JSON.stringify({ error: `This post was declined${existing.declined_by ? ` by ${existing.declined_by}` : ''} and cannot be published.` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Enhanced Duplicate Guard ──────────────────────────────────
      if (existing) {
        const dayStr = existing.scheduled_date
          ? new Date(existing.scheduled_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        const { data: publishedToday } = await supabaseAdmin
          .from("social_posts")
          .select("id, title, content, image_url, page_name")
          .eq("platform", existing.platform)
          .eq("status", "published")
          .neq("id", post_id)
          .gte("scheduled_date", `${dayStr}T00:00:00Z`)
          .lte("scheduled_date", `${dayStr}T23:59:59Z`)
          .limit(50);

        const postPages = existing.page_name
          ? existing.page_name.split(", ").map((p: string) => p.trim()).filter(Boolean)
          : [];

        if (publishedToday && publishedToday.length > 0) {
          for (const pub of publishedToday) {
            const sameContent = pub.content === existing.content && pub.image_url === existing.image_url;
            const sameTitle = pub.title && existing.title && pub.title === existing.title;

            if (sameContent || sameTitle) {
              const pubPages = pub.page_name
                ? pub.page_name.split(", ").map((p: string) => p.trim()).filter(Boolean)
                : [];
              const hasPageOverlap = postPages.length === 0 || pubPages.length === 0
                || postPages.some((pg: string) => pubPages.includes(pg));

              if (hasPageOverlap) {
                console.warn(`[social-publish] BLOCKED — duplicate content already published: ${pub.id}`);
                return new Response(
                  JSON.stringify({ error: "Duplicate — this content was already published to this platform today." }),
                  { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          }
        }
      }

      // Look up publisher's email for canPublish bypass
      const { data: publisher } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      const publisherEmail = (publisher?.email || "").toLowerCase();
      const canBypassApproval = ["radin@rebar.shop", "zahra@rebar.shop"].includes(publisherEmail);

      // HARD GATE: require neel_approved unless user has publish bypass
      if (!existing?.neel_approved && !canBypassApproval) {
        console.warn(`[social-publish] BLOCKED — post ${post_id} not approved by Neel/Sattar`);
        return new Response(
          JSON.stringify({ error: "This post requires approval from Neel or Sattar before publishing." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Atomic Lock ──────────────────────────────────────────────
      const lock = await acquirePublishLock(supabaseAdmin, post_id, ["scheduled", "draft"]);
      if (!lock.locked) {
        console.warn(`[social-publish] Cannot acquire lock for post ${post_id}: ${lock.reason}`);
        return new Response(
          JSON.stringify({ error: `Cannot publish: ${lock.reason}` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[social-publish] Acquired lock for post ${post_id}: lockId=${lock.lockId}`);
    }

    // Get user token — OWNER-FIRST, team fallback if owner lacks token
    const tokenPlatform = platform === "instagram" ? "instagram" : "facebook";
    let tokenData = (await supabaseAdmin
      .from("user_meta_tokens")
      .select("access_token, pages, instagram_accounts, user_id")
      .eq("user_id", userId)
      .eq("platform", tokenPlatform)
      .maybeSingle()).data;

    let tokenOwnerUserId = userId;

    if (!tokenData && (platform === "facebook" || platform === "instagram")) {
      // Team fallback: find a teammate in the same company with a valid token
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (ownerProfile?.company_id) {
        const { data: teammates } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("company_id", ownerProfile.company_id)
          .neq("user_id", userId);

        if (teammates && teammates.length > 0) {
          for (const tm of teammates) {
            const { data: tmToken } = await supabaseAdmin
              .from("user_meta_tokens")
              .select("access_token, pages, instagram_accounts, user_id")
              .eq("user_id", tm.user_id)
              .eq("platform", tokenPlatform)
              .maybeSingle();
            if (tmToken && tmToken.access_token) {
              tokenData = tmToken;
              tokenOwnerUserId = tm.user_id;
              console.log(`[social-publish] Team fallback: using ${tokenPlatform} token from user ${tm.user_id}`);
              break;
            }
          }
        }
      }

      if (!tokenData) {
        const errMsg = `${platform} not connected for your account or any teammate. Please connect it from Integrations.`;
        if (post_id) {
          const lockId = (await supabaseAdmin.from("social_posts").select("publishing_lock_id").eq("id", post_id).maybeSingle()).data?.publishing_lock_id;
          if (lockId) await releasePublishLock(supabaseAdmin, post_id, lockId, "failed", { last_error: errMsg });
        }
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Multi-Page Publishing Loop ────────────────────────────────
    const dbPageName = postRecord?.page_name || page_name || "";
    const individualPages = dbPageName ? dbPageName.split(", ").map((p: string) => p.trim()).filter(Boolean) : [];

    const pageErrors: string[] = [];
    const pageSuccesses: string[] = [];

    // Get lock ID for final status update
    let lockId: string | null = null;
    if (post_id) {
      const { data: lockData } = await supabaseAdmin.from("social_posts").select("publishing_lock_id").eq("id", post_id).maybeSingle();
      lockId = lockData?.publishing_lock_id;
    }

    if (platform === "facebook" || platform === "instagram") {
      const pages = (tokenData!.pages as Array<{ id: string; name: string }>) || [];
      if (pages.length === 0) {
        const errMsg = "No Facebook Pages found. Make sure your account has at least one Page.";
        if (post_id && lockId) await releasePublishLock(supabaseAdmin, post_id, lockId, "failed", { last_error: errMsg });
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // NO FALLBACK: if no pages assigned, fail explicitly
      if (individualPages.length === 0) {
        const errMsg = "No pages assigned to post (page_name is empty). Cannot publish without explicit page assignment.";
        console.error(`[social-publish] FAIL: ${errMsg}`);
        if (post_id && lockId) await releasePublishLock(supabaseAdmin, post_id, lockId, "failed", { last_error: errMsg });
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[social-publish] target_pages=[${individualPages.join(", ")}], available_pages=[${pages.map(p => p.name).join(", ")}]`);

      const publishedFbPageIds = new Set<string>();
      const publishedIgIds = new Set<string>();
      const igPublishQueue: Array<{ igAccountId: string; pageAccessToken: string; targetPageName: string }> = [];

      for (const targetPageName of individualPages) {
        if (!targetPageName) {
          console.warn(`[social-publish] SKIP — empty page name, no fallback`);
          pageErrors.push("Empty page name — skipped");
          continue;
        }

        // Normalized matching
        const normalizedTarget = normalizePageName(targetPageName);
        const selectedPage = pages.find((p) => normalizePageName(p.name || "") === normalizedTarget);
        if (!selectedPage) {
          console.warn(`[social-publish] SKIP — page "${targetPageName}" not found among [${pages.map(p => p.name).join(", ")}]. Will NOT fall back.`);
          pageErrors.push(`Page "${targetPageName}": not found in connected pages — skipped`);
          continue;
        }
        const pageId = selectedPage.id;

        // Get page-specific access token (use token owner, not post owner)
        const { data: pageTokenData } = await supabaseAdmin
          .from("user_meta_tokens")
          .select("access_token")
          .eq("user_id", tokenOwnerUserId)
          .eq("platform", `${tokenPlatform}_page_${pageId}`)
          .maybeSingle();
        let pageAccessToken = pageTokenData?.access_token || tokenData!.access_token;

        let result: { id?: string; error?: string };

        if (platform === "facebook") {
          // Refresh page token
          const userLongLivedToken = tokenData!.access_token;
          const refreshedToken = await refreshPageToken(userLongLivedToken, pageId);
          if (refreshedToken) {
            pageAccessToken = refreshedToken;
            await supabaseAdmin
              .from("user_meta_tokens")
              .upsert({
                user_id: tokenOwnerUserId,
                platform: `facebook_page_${pageId}`,
                access_token: refreshedToken,
              }, { onConflict: "user_id,platform" });
          }

          // Pre-flight: verify token
          const preflightRes = await fetch(`${GRAPH_API}/${pageId}?fields=id,name&access_token=${pageAccessToken}`);
          const preflightData = await preflightRes.json();
          if (preflightData.error) {
            console.error(`[social-publish] Facebook pre-flight failed for page "${targetPageName}":`, preflightData.error);
            pageErrors.push(`Page "${targetPageName}": ${preflightData.error.message || "Permission check failed"}`);
            if (post_id) {
              await supabaseAdmin.from("social_posts").update({ last_error: `Facebook permission error on page "${targetPageName}"` }).eq("id", post_id);
            }
            continue;
          }

          // Verify pages_manage_posts permission
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
            console.warn(`[social-publish] Permission check failed for page "${targetPageName}", proceeding:`, permErr);
          }

          if (publishedFbPageIds.has(pageId)) {
            console.log(`[social-publish] Skipping page "${targetPageName}" — FB page ${pageId} already published`);
            pageSuccesses.push(targetPageName);
            continue;
          }
          publishedFbPageIds.add(pageId);

          result = await publishToFacebook(pageId, pageAccessToken, message, image_url);
        } else {
          // Instagram — collect for parallel publishing below
          const userLongLivedToken = tokenData!.access_token;
          const refreshedToken = await refreshPageToken(userLongLivedToken, pageId);
          if (refreshedToken) {
            pageAccessToken = refreshedToken;
            await supabaseAdmin
              .from("user_meta_tokens")
              .upsert({
                user_id: tokenOwnerUserId,
                platform: `instagram_page_${pageId}`,
                access_token: refreshedToken,
              }, { onConflict: "user_id,platform" });
            console.log(`[social-publish] Refreshed page token for IG (page ${pageId})`);
          }

          const igAccounts = (tokenData!.instagram_accounts as Array<{ id: string; username: string; pageId: string }>) || [];
          console.log(`[social-publish] IG accounts available: [${igAccounts.map(ig => `${ig.id}(page=${ig.pageId})`).join(", ")}]`);
          if (igAccounts.length === 0) {
            pageErrors.push(`Page "${targetPageName}": No Instagram Business Account found`);
            continue;
          }
          const selectedIg = igAccounts.find((ig) => ig.pageId === pageId);
          if (!selectedIg) {
            console.warn(`[social-publish] SKIP — no IG account linked to FB page ${pageId} ("${targetPageName}")`);
            pageErrors.push(`Page "${targetPageName}": no linked Instagram account — skipped`);
            continue;
          }
          console.log(`[social-publish] Matched IG account: id=${selectedIg.id}, username=${selectedIg.username || "unknown"}, for page "${targetPageName}"`);
          if (publishedIgIds.has(selectedIg.id)) {
            console.log(`[social-publish] Skipping page "${targetPageName}" — IG account ${selectedIg.id} already published`);
            pageSuccesses.push(targetPageName);
            continue;
          }
          publishedIgIds.add(selectedIg.id);
          // Queue for parallel execution
          igPublishQueue.push({ igAccountId: selectedIg.id, pageAccessToken, targetPageName });
          continue; // Don't process result here — handled after parallel publish
        }

        if (result.error) {
          console.error(`[social-publish] Failed on page "${targetPageName}": ${result.error}`);
          pageErrors.push(`Page "${targetPageName}": ${result.error}`);
        } else {
          console.log(`[social-publish] Published to page "${targetPageName}" (id: ${result.id})`);
          pageSuccesses.push(targetPageName);
        }
      }

      // --- Parallel Instagram publishing ---
      if (igPublishQueue.length > 0) {
        console.log(`[social-publish] Publishing to ${igPublishQueue.length} IG accounts in parallel`);
        const igResults = await Promise.allSettled(
          igPublishQueue.map(({ igAccountId, pageAccessToken: pat, targetPageName: tpn }) =>
            publishToInstagram(igAccountId, pat, message, image_url, content_type, cover_image_url)
              .then(r => ({ ...r, targetPageName: tpn }))
              .catch(e => ({ error: e?.message || String(e), targetPageName: tpn }))
          )
        );
        for (const settled of igResults) {
          const r = settled.status === "fulfilled" ? settled.value : { error: (settled.reason?.message || String(settled.reason)), targetPageName: "unknown" };
          if (r.error) {
            console.error(`[social-publish] IG parallel failed on "${r.targetPageName}": ${r.error}`);
            pageErrors.push(`Page "${r.targetPageName}": ${r.error}`);
          } else {
            console.log(`[social-publish] IG parallel published to "${r.targetPageName}" (id: ${(r as any).id})`);
            pageSuccesses.push(r.targetPageName);
          }
        }
      }
    } else if (platform === "linkedin") {
      const result = await publishToLinkedIn(supabaseAdmin, userId, message, image_url);
      if (result.error) {
        pageErrors.push(result.error);
      } else {
        pageSuccesses.push("linkedin");
      }
    } else if (platform === "twitter") {
      const result = await publishToTwitter(message, image_url);
      if (result.error) {
        pageErrors.push(result.error);
      } else {
        pageSuccesses.push("twitter");
      }
    } else {
      if (post_id && lockId) await releasePublishLock(supabaseAdmin, post_id, lockId, "failed", { last_error: `Platform ${platform} not supported` });
      return new Response(
        JSON.stringify({ error: `Publishing to ${platform} is not yet supported.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine final result
    if (pageSuccesses.length > 0) {
      if (post_id && lockId) {
        const partialError = pageErrors.length > 0 ? `Partial: ${pageErrors.join("; ")}` : null;
        await releasePublishLock(supabaseAdmin, post_id, lockId, "published", {
          ...(partialError ? { last_error: partialError } : {}),
        });
      }
      return new Response(
        JSON.stringify({ success: true, platform, pages: pageSuccesses, errors: pageErrors.length > 0 ? pageErrors : undefined }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errMsg = pageErrors.join("; ") || "Unknown publishing error";
      if (post_id && lockId) {
        await releasePublishLock(supabaseAdmin, post_id, lockId, "failed", { last_error: errMsg });
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }, { functionName: "social-publish", requireCompany: false, wrapResult: false })
);

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  imageUrl?: string,
  contentType: string = "post"
): Promise<{ id?: string; error?: string }> {
  try {
    let url: string;
    const params: Record<string, string> = { access_token: accessToken };

    // Detect video content (same pattern as Instagram)
    let isVideo = false;
    if (imageUrl) {
      isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
      if (!isVideo) {
        try {
          const head = await fetch(imageUrl, { method: "HEAD" });
          const ct = head.headers.get("content-type") || "";
          isVideo = ct.startsWith("video/");
        } catch { /* ignore HEAD failures */ }
      }
    }

    if (imageUrl && isVideo) {
      // Video → use /videos endpoint
      url = `${GRAPH_API}/${pageId}/videos`;
      params.file_url = imageUrl;
      params.description = message;
      console.log(`[social-publish] Facebook video detected, using /videos endpoint`);
    } else if (imageUrl) {
      // Photo → use /photos endpoint
      url = `${GRAPH_API}/${pageId}/photos`;
      params.url = imageUrl;
      params.message = message;
    } else {
      // Text only → use /feed endpoint
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
  imageUrl?: string,
  contentType: string = "post",
  coverImageUrl?: string
): Promise<{ id?: string; error?: string }> {
  try {
    if (!imageUrl) {
      return { error: "Instagram requires an image to publish. Please add an image to your post." };
    }

    const isStory = contentType === "story";

    // Detect video
    let isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
    if (!isVideo) {
      try {
        const head = await fetch(imageUrl, { method: "HEAD" });
        const ct = head.headers.get("content-type") || "";
        isVideo = ct.startsWith("video/");
      } catch { /* ignore HEAD failures */ }
    }

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
      console.log(`[social-publish] Publishing Instagram Story (video=${isVideo})`);
    } else if (isVideo) {
      containerBody.media_type = "REELS";
      containerBody.video_url = imageUrl;
      containerBody.caption = caption;
      if (coverImageUrl) {
        containerBody.cover_url = coverImageUrl;
        console.log(`[social-publish] Using cover image for reel: ${coverImageUrl.substring(0, 60)}…`);
      }
    } else {
      containerBody.image_url = imageUrl;
      containerBody.caption = caption;
    }

    console.log(`[social-publish] Creating container for IG account ${igAccountId}, media_type=${containerBody.media_type || "IMAGE"}`);

    const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });

    const containerData = await containerRes.json();
    if (containerData.error) {
      console.error("Instagram container error:", containerData.error);
      return { error: `Instagram: ${containerData.error.message}` };
    }

    const containerId = containerData.id;
    console.log(`[social-publish] Container created: ${containerId}`);

    // Poll for ready
    const maxPolls = isVideo ? 30 : 20;
    const pollInterval = isVideo ? 3000 : 2000;
    let ready = false;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const statusRes = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusRes.json();
      console.log(`[IG] Poll ${i + 1}/${maxPolls}: status=${statusData.status_code}, raw=${JSON.stringify(statusData)}`);

      if (statusData.error) {
        console.error(`[IG] Poll error: ${statusData.error.message}`);
        return { error: `Instagram polling error: ${statusData.error.message}` };
      }

      if (statusData.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (statusData.status_code === "ERROR") {
        return { error: "Instagram media processing failed. Try a different image/video." };
      }
    }

    if (!ready) {
      return { error: `Instagram media processing timed out after ${maxPolls * pollInterval / 1000}s. Try again.` };
    }

    // Publish
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
    // OWNER-ONLY: no team fallback
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("integration_id", "linkedin")
      .maybeSingle();

    if (!connection) return { error: `LinkedIn not connected for your account. Owner-only token policy — please connect it from Settings → Integrations.` };
    const config = connection.config as { access_token: string; expires_at: number };

    if (config.expires_at < Date.now()) return { error: "LinkedIn token expired. Please reconnect." };

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
      return { error: "Twitter API credentials not configured." };
    }

    let mediaId: string | undefined;

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

    const tweetUrl = "https://api.x.com/2/tweets";
    const tweetBody: any = { text };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

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
