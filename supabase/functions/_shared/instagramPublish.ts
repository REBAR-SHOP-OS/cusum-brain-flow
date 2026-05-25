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
};

const PROCESSING_PUBLISH_DELAYS_MS = [15000, 30000, 45000, 60000, 60000, 60000];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthError(error: MetaError | undefined) {
  if (!error) return false;

  if (isNotReadyError(error) || isContainerExpiredError(error) || isSpuriousStatusError(error)) {
    return false;
  }

  const code = error.code;
  const text = `${error.message || ""} ${error.error_user_msg || ""}`.toLowerCase();

  if (code === 190 || code === 102 || code === 10 || code === 200 || code === 298) {
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
  const text = `${error.message || ""} ${error.error_user_msg || ""}`.toLowerCase();
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

async function detectVideoMedia(imageUrl: string) {
  let isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
  if (!isVideo) {
    try {
      const head = await fetch(imageUrl, { method: "HEAD" });
      const contentType = head.headers.get("content-type") || "";
      isVideo = contentType.startsWith("video/");
    } catch {
      // Ignore HEAD failures and fall back to URL detection only.
    }
  }
  return isVideo;
}

async function fetchContainerStatus(containerId: string, accessToken: string, logPrefix: string) {
  try {
    const statusRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const statusData = await statusRes.json();
    console.log(`${logPrefix} Container status for ${containerId}: ${JSON.stringify(statusData)}`);
    return statusData;
  } catch (error) {
    console.warn(`${logPrefix} Container status fetch failed for ${containerId}:`, error);
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

  console.log(`${logPrefix} Instagram publish succeeded for container ${containerId}: ${publishData.id}`);
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
      return { error: "Instagram requires an image to publish. Please add an image to your post." };
    }

    const isStory = contentType === "story";
    const isVideo = await detectVideoMedia(imageUrl);
    const requiresProcessing = isVideo || isStory;

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
      console.log(`${logPrefix} Creating Instagram Story container (video=${isVideo})`);
    } else if (isVideo) {
      containerBody.media_type = "REELS";
      containerBody.video_url = imageUrl;
      containerBody.caption = caption;
      if (coverImageUrl) {
        containerBody.cover_url = coverImageUrl;
        console.log(`${logPrefix} Using reel cover image: ${coverImageUrl.substring(0, 60)}…`);
      }
    } else {
      containerBody.image_url = imageUrl;
      containerBody.caption = caption;
    }

    console.log(`${logPrefix} Creating container for IG account ${igAccountId}, media_type=${containerBody.media_type || "IMAGE"}`);

    let containerData: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      });
      containerData = await containerRes.json();

      if (containerData.error?.is_transient && attempt < 2) {
        console.warn(`${logPrefix} Transient container error on attempt ${attempt + 1}, retrying in 3s...`);
        await wait(3000);
        continue;
      }
      break;
    }

    if (containerData.error) {
      console.error(`${logPrefix} Instagram container error:`, containerData.error);
      if (isAuthError(containerData.error)) {
        return { error: "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations." };
      }
      return { error: `Instagram: ${containerData.error.message}` };
    }

    const containerId = containerData.id;
    console.log(`${logPrefix} Container created: ${containerId}`);

    const attemptDelays = requiresProcessing ? PROCESSING_PUBLISH_DELAYS_MS : [0];

    for (let attempt = 0; attempt < attemptDelays.length; attempt++) {
      const delay = attemptDelays[attempt];
      if (delay > 0) {
        console.log(`${logPrefix} Waiting ${delay}ms before publish attempt ${attempt + 1}/${attemptDelays.length} for container ${containerId}`);
        await wait(delay);
      }

      if (requiresProcessing) {
        const statusData = await fetchContainerStatus(containerId, accessToken, logPrefix);
        const statusError = statusData?.error as MetaError | undefined;
        const statusCode = statusData?.status_code as string | undefined;

        if (statusError) {
          if (isAuthError(statusError)) {
            return { error: "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations." };
          }
          if (isSpuriousStatusError(statusError)) {
            console.log(`${logPrefix} Container status is still inconclusive (100/33); continuing with guarded publish retries.`);
          } else {
            console.warn(`${logPrefix} Container status check returned non-terminal error; continuing cautiously.`);
          }
        } else if (statusCode === "ERROR") {
          return { error: "Instagram media processing failed. Try a different image/video." };
        } else if (statusCode === "EXPIRED") {
          return { error: "Instagram media container expired before it became ready. Please try publishing again." };
        } else if (statusCode === "FINISHED" || statusCode === "PUBLISHED") {
          console.log(`${logPrefix} Container ${containerId} is ready with status ${statusCode}.`);
        } else if (statusCode) {
          console.log(`${logPrefix} Container ${containerId} still processing with status ${statusCode}.`);
        }
      }

      const publishResult = await tryPublishContainer(igAccountId, accessToken, containerId, logPrefix);
      if (publishResult.ok) {
        return { id: publishResult.data.id };
      }

      if (isAuthError(publishResult.error)) {
        return { error: "Instagram token expired or missing permissions — please reconnect Facebook/Instagram in Integrations." };
      }

      if (isContainerExpiredError(publishResult.error)) {
        return { error: "Instagram media container expired before publish completed. Please try again." };
      }

      if (isNotReadyError(publishResult.error) && attempt < attemptDelays.length - 1) {
        console.warn(`${logPrefix} Container ${containerId} not ready on publish attempt ${attempt + 1}; retrying.`);
        continue;
      }

      return { error: `Instagram: ${publishResult.error.message || "Unknown publish error"}` };
    }

    return { error: "Instagram media is still processing after several minutes. Try again shortly." };
  } catch (err) {
    return { error: `Instagram publish failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}