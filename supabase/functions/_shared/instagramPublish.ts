import { probeVideoForInstagram, describeProbeFailure } from "./videoProbe.ts";

const GRAPH_API = "https://graph.facebook.com/v21.0";

type InstagramPublishParams = {
  igAccountId: string;
  accessToken: string;
  caption: string;
  imageUrl?: string | null;
  contentType?: string;
  coverImageUrl?: string | null;
  logPrefix: string;
};

type PublishResult = {
  id?: string;
  error?: string;
};

type MetaError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  is_transient?: boolean;
  fbtrace_id?: string;
};

const PROCESSING_PUBLISH_DELAYS_MS = [15000, 30000, 45000, 60000, 60000, 60000];
const INSTAGRAM_VIDEO_SPEC_ERROR =
  "Instagram rejected the video. Likely cause: frame rate >60 fps, bitrate >25 Mbps, or H.264 level >4.x (common with browser-recorded MP4s). Re-publish from the app — it will auto-normalize the video to IG-safe spec (30 fps, 8 Mbps, level 4.1).";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a Supabase Storage URL with the ig-media-proxy edge function so Meta's
 * fetcher receives a clean image/jpeg response (no CF bot-management cookies,
 * PNG sources re-encoded to JPEG). Non-Supabase URLs are returned unchanged.
 */
function wrapWithIgMediaProxy(srcUrl: string): string {
  try {
    const parsed = new URL(srcUrl);
    if (!parsed.hostname.endsWith(".supabase.co")) return srcUrl;
    if (parsed.pathname.includes("/functions/v1/ig-media-proxy")) return srcUrl;
    const projectUrl = Deno.env.get("SUPABASE_URL");
    if (!projectUrl) return srcUrl;
    return `${projectUrl.replace(/\/$/, "")}/functions/v1/ig-media-proxy?src=${
      encodeURIComponent(srcUrl)
    }`;
  } catch {
    return srcUrl;
  }
}

function isAuthError(error: MetaError | undefined) {
  if (!error) return false;

  if (
    isNotReadyError(error) ||
    isContainerExpiredError(error) ||
    isSpuriousStatusError(error)
  ) {
    return false;
  }

  const code = error.code;
  const text =
    `${error.message || ""} ${error.error_user_msg || ""}`.toLowerCase();

  if (
    code === 190 ||
    code === 102 ||
    code === 10 ||
    code === 200 ||
    code === 298
  ) {
    return true;
  }

  return (
    text.includes("access token") ||
    text.includes("session has expired") ||
    text.includes("missing permission") ||
    text.includes("permissions error") ||
    text.includes("does not have permission") ||
    text.includes("requires page publishing authorization") ||
    text.includes("two-factor authentication")
  );
}

function isNotReadyError(error: MetaError | undefined) {
  if (!error) return false;
  const text =
    `${error.message || ""} ${error.error_user_msg || ""}`.toLowerCase();
  return (
    (error.code === 9007 && error.error_subcode === 2207027) ||
    text.includes("media id is not available") ||
    text.includes("not ready for publishing")
  );
}

function isContainerExpiredError(error: MetaError | undefined) {
  if (!error) return false;
  return error.error_subcode === 2207008;
}

function isSpuriousStatusError(error: MetaError | undefined) {
  if (!error) return false;
  return error.code === 100 && error.error_subcode === 33;
}

async function detectMediaDetails(imageUrl: string) {
  let contentType = "";
  let isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
  if (!isVideo) {
    try {
      const head = await fetch(imageUrl, { method: "HEAD" });
      contentType = head.headers.get("content-type") || "";
      isVideo = contentType.startsWith("video/");
    } catch {
      // Ignore HEAD failures and fall back to URL detection only.
    }
  } else {
    try {
      const head = await fetch(imageUrl, { method: "HEAD" });
      contentType = head.headers.get("content-type") || "";
    } catch {
      // Ignore HEAD failures and fall back to URL detection only.
    }
  }
  return { isVideo, contentType };
}

function isClearlyUnsupportedInstagramVideo(imageUrl: string, contentType: string) {
  const lowerUrl = imageUrl.toLowerCase();
  const lowerType = contentType.toLowerCase();
  return (
    lowerUrl.includes(".webm") ||
    lowerType.includes("webm") ||
    lowerType.includes("matroska") ||
    lowerType.includes("quicktime") ||
    lowerType.includes("x-msvideo") ||
    lowerType.includes("x-ms-wmv")
  );
}

async function fetchContainerStatus(
  containerId: string,
  accessToken: string,
  logPrefix: string,
) {
  try {
    const statusRes = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const statusData = await statusRes.json();
    console.log(
      `${logPrefix} Container status for ${containerId}: ${JSON.stringify(statusData)}`,
    );
    return statusData;
  } catch (error) {
    console.warn(
      `${logPrefix} Container status fetch failed for ${containerId}:`,
      error,
    );
    return null;
  }
}

async function tryPublishContainer(
  igAccountId: string,
  accessToken: string,
  containerId: string,
  logPrefix: string,
): Promise<{ ok: true; data: any } | { ok: false; error: MetaError }> {
  const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ creation_id: containerId }),
  });

  const publishData = await publishRes.json();
  if (publishData.error) {
    console.error(`${logPrefix} Instagram publish error:`, publishData.error);
    return { ok: false, error: publishData.error };
  }

  console.log(
    `${logPrefix} Instagram publish succeeded for container ${containerId}: ${publishData.id}`,
  );
  return { ok: true, data: publishData };
}

export async function publishInstagramMedia({
  igAccountId,
  accessToken,
  caption,
  imageUrl,
  contentType = "post",
  coverImageUrl,
  logPrefix,
}: InstagramPublishParams): Promise<PublishResult> {
  try {
    if (!imageUrl) {
      return {
        error:
          "Instagram requires an image to publish. Please add an image to your post.",
      };
    }

    const isStory = contentType === "story";
    const mediaDetails = await detectMediaDetails(imageUrl);
    const isVideo = mediaDetails.isVideo;
    const requiresProcessing = isVideo || isStory;

    // Route non-video images through the ig-media-proxy so Meta sees a clean
    // image/jpeg URL with no Cloudflare bot-management cookies and no PNG
    // edge-case quirks that have caused intermittent "code 2 / unexpected
    // error" container failures across all linked IG accounts.
    if (!isVideo) {
      imageUrl = wrapWithIgMediaProxy(imageUrl);
    }

    if (isVideo && isClearlyUnsupportedInstagramVideo(imageUrl, mediaDetails.contentType)) {
      console.warn(
        `${logPrefix} BLOCKED unsupported Instagram video (extension/mime): content_type=${mediaDetails.contentType || "unknown"}, url=${imageUrl}`,
      );
      return { error: INSTAGRAM_VIDEO_SPEC_ERROR };
    }

    // Deep codec probe — catches MP4 containers wrapping HEVC/VP9/AV1 or files
    // missing an AAC audio track. Without this, Instagram accepts the container
    // and rejects it later during processing with the generic spec error, which
    // is exactly the failure the Publishing Failed dialog was showing.
    if (isVideo) {
      const probe = await probeVideoForInstagram(imageUrl);
      console.log(
        `${logPrefix} IG codec probe: video=${probe.videoCodec} audio=${probe.audioCodec} container=${probe.container} ready=${probe.isInstagramReady} reason=${probe.reason}`,
      );
      if (!probe.isInstagramReady && probe.inspected) {
        return { error: `${INSTAGRAM_VIDEO_SPEC_ERROR} ${describeProbeFailure(probe)}` };
      }
      // If the probe could not inspect the file (HEAD/Range blocked), we allow
      // the upload but Meta's own processing will still catch it; we already
      // surface that error path.
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
      console.log(
        `${logPrefix} Creating Instagram Story container (video=${isVideo})`,
      );
    } else if (isVideo) {
      containerBody.media_type = "REELS";
      containerBody.video_url = imageUrl;
      containerBody.caption = caption;
      if (coverImageUrl) {
        containerBody.cover_url = coverImageUrl;
        console.log(
          `${logPrefix} Using reel cover image: ${coverImageUrl.substring(0, 60)}…`,
        );
      }
    } else {
      containerBody.image_url = imageUrl;
      containerBody.caption = caption;
    }

    console.log(
      `${logPrefix} Creating container for IG account ${igAccountId}, media_type=${containerBody.media_type || "IMAGE"}, url=${imageUrl}, content_type=${mediaDetails.contentType || "unknown"}, size=${mediaDetails.contentLength ?? "unknown"}`,
    );

    // Pre-flight: verify Meta can actually fetch the media URL. Code 2 ("unexpected
    // error") on container creation across multiple accounts almost always means
    // Meta's fetcher cannot read the URL (403, redirect, wrong content-type, etc).
    try {
      const head = await fetch(imageUrl, { method: "HEAD", redirect: "follow" });
      if (!head.ok) {
        console.error(
          `${logPrefix} Media URL not publicly fetchable: HTTP ${head.status} for ${imageUrl}`,
        );
        return {
          error: `Instagram could not fetch the media (HTTP ${head.status}). The image URL is not publicly accessible — re-upload the asset and try again.`,
        };
      }
    } catch (e) {
      console.warn(`${logPrefix} HEAD pre-flight failed (continuing): ${(e as Error).message}`);
    }

    let containerData: any;
    // Exponential backoff with jitter for Meta's transient code 2
    // ("An unexpected error has occurred"). Common when many IG accounts
    // hit Graph API in parallel — needs >10s, not 3s, to clear.
    const TRANSIENT_DELAYS_MS = [2000, 6000, 15000, 30000];
    for (let attempt = 0; attempt < TRANSIENT_DELAYS_MS.length + 1; attempt++) {
      const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      });
      containerData = await containerRes.json();

      const err = containerData.error as MetaError | undefined;
      const isTransient =
        !!err &&
        (err.is_transient === true || err.code === 1 || err.code === 2 || err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613);

      if (isTransient && attempt < TRANSIENT_DELAYS_MS.length) {
        const base = TRANSIENT_DELAYS_MS[attempt];
        const jitter = Math.floor(Math.random() * 1500);
        const delayMs = base + jitter;
        console.warn(
          `${logPrefix} Transient container error code=${err?.code} on attempt ${attempt + 1}, retrying in ${delayMs}ms...`,
        );
        await wait(delayMs);
        continue;
      }
      break;
    }

    if (containerData.error) {
      console.error(
        `${logPrefix} Instagram container error:`,
        containerData.error,
      );
      if (isAuthError(containerData.error)) {
        return {
          error:
            "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations.",
        };
      }
      const e = containerData.error as MetaError;
      if (e.is_transient || e.code === 1 || e.code === 2) {
        return {
          error:
            `Instagram rejected the media (Meta code ${e.code}, fbtrace ${e.fbtrace_id || "n/a"}). This usually means Meta could not fetch/process the image at this URL. Re-upload the asset or wait 2–5 minutes and retry.`,
        };
      }
      return { error: `Instagram: ${containerData.error.message}` };
    }

    const containerId = containerData.id;
    console.log(`${logPrefix} Container created: ${containerId}`);

    const attemptDelays = requiresProcessing
      ? PROCESSING_PUBLISH_DELAYS_MS
      : [0];

    for (let attempt = 0; attempt < attemptDelays.length; attempt++) {
      const delay = attemptDelays[attempt];
      if (delay > 0) {
        console.log(
          `${logPrefix} Waiting ${delay}ms before publish attempt ${attempt + 1}/${attemptDelays.length} for container ${containerId}`,
        );
        await wait(delay);
      }

      if (requiresProcessing) {
        const statusData = await fetchContainerStatus(
          containerId,
          accessToken,
          logPrefix,
        );
        const statusError = statusData?.error as MetaError | undefined;
        const statusCode = statusData?.status_code as string | undefined;

        if (statusError) {
          if (isAuthError(statusError)) {
            return {
              error:
                "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations.",
            };
          }
          if (isSpuriousStatusError(statusError)) {
            console.log(
              `${logPrefix} Container status is still inconclusive (100/33); continuing with guarded publish retries.`,
            );
          } else {
            console.warn(
              `${logPrefix} Container status check returned non-terminal error; continuing cautiously.`,
            );
          }
        } else if (statusCode === "ERROR") {
          return {
            error: isVideo
              ? `${INSTAGRAM_VIDEO_SPEC_ERROR} Instagram rejected this upload during processing.`
              : "Instagram media processing failed. Try a different image/video.",
          };
        } else if (statusCode === "EXPIRED") {
          return {
            error:
              "Instagram media container expired before it became ready. Please try publishing again.",
          };
        } else if (statusCode === "FINISHED" || statusCode === "PUBLISHED") {
          console.log(
            `${logPrefix} Container ${containerId} is ready with status ${statusCode}.`,
          );
        } else if (statusCode) {
          console.log(
            `${logPrefix} Container ${containerId} still processing with status ${statusCode}.`,
          );
        }
      }

      const publishResult = await tryPublishContainer(
        igAccountId,
        accessToken,
        containerId,
        logPrefix,
      );
      if (publishResult.ok) {
        return { id: publishResult.data.id };
      }

      if (isAuthError(publishResult.error)) {
        return {
          error:
            "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations.",
        };
      }

      if (isContainerExpiredError(publishResult.error)) {
        return {
          error:
            "Instagram media container expired before publish completed. Please try again.",
        };
      }

      if (
        isNotReadyError(publishResult.error) &&
        attempt < attemptDelays.length - 1
      ) {
        console.warn(
          `${logPrefix} Container ${containerId} not ready on publish attempt ${attempt + 1}; retrying.`,
        );
        continue;
      }

      return {
        error: `Instagram: ${publishResult.error.message || "Unknown publish error"}`,
      };
    }

    return {
      error:
        "Instagram media is still processing after several minutes. Try again shortly.",
    };
  } catch (err) {
    return {
      error: `Instagram publish failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}
