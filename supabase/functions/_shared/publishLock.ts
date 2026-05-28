/**
 * Atomic publish lock for social posts.
 * Prevents race conditions between social-publish (manual) and social-cron-publish (scheduled).
 *
 * Pattern: optimistic locking via Supabase `.update().eq("status", "scheduled")`.
 * Only one caller wins — the DB update is atomic.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LockResult {
  locked: boolean;
  lockId?: string;
  reason?: string;
}

/**
 * Atomically acquire a publishing lock on a post.
 * Only succeeds if the post's current status is in the allowed set.
 */
export async function acquirePublishLock(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  allowedStatuses: string[] = ["scheduled"],
): Promise<LockResult> {
  const lockId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Try each allowed status — Supabase doesn't support `.in()` on update filters well
  for (const status of allowedStatuses) {
    const { data, error } = await supabase
      .from("social_posts")
      .update({
        status: "publishing",
        publishing_lock_id: lockId,
        publishing_started_at: now,
      })
      .eq("id", postId)
      .eq("status", status)
      .select("id")
      .maybeSingle();

    if (data) {
      return { locked: true, lockId };
    }
    if (error) {
      console.warn(`[publishLock] Update error for status=${status}: ${error.message}`);
    }
  }

  // Lock failed — check current status for diagnostics
  const { data: current } = await supabase
    .from("social_posts")
    .select("status, publishing_lock_id")
    .eq("id", postId)
    .maybeSingle();

  const reason = current
    ? `Post is already in status="${current.status}" (lock=${current.publishing_lock_id || "none"})`
    : `Post ${postId} not found`;

  return { locked: false, reason };
}

/**
 * Release the publishing lock and set final status.
 * Only updates if the lock ID matches — prevents stale processes from overwriting.
 */
export async function releasePublishLock(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  lockId: string,
  finalStatus: "published" | "failed",
  extra?: { last_error?: string; qa_status?: string },
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {
    status: finalStatus,
    publishing_lock_id: null,
    publishing_started_at: null,
    ...extra,
  };

  const { data } = await supabase
    .from("social_posts")
    .update(updatePayload)
    .eq("id", postId)
    .eq("publishing_lock_id", lockId)
    .select("id")
    .maybeSingle();

  if (!data) {
    console.warn(`[publishLock] Release failed — lock mismatch for post ${postId} (expected lockId=${lockId})`);
    return false;
  }
  return true;
}

/**
 * Per-page publish result entry stored in social_posts.page_results jsonb.
 */
export interface PageResult {
  name: string;
  status: "pending" | "success" | "failed";
  error?: string;
  platform_post_id?: string;
  completed_at?: string;
}

/**
 * Initialize page_results to a list of pending entries for the given pages.
 * Should be called once at the start of a publish run (after lock acquired).
 */
export async function initPageResults(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  pageNames: string[],
): Promise<void> {
  const initial: PageResult[] = pageNames.map((name) => ({ name, status: "pending" }));
  await supabase
    .from("social_posts")
    .update({ page_results: initial })
    .eq("id", postId);
}

/**
 * Record (upsert) a single page's publish outcome into page_results.
 * Safe to call multiple times — last call wins for that page name.
 * Uses read-modify-write; acceptable because publishing is serialized per post.
 */
export async function recordPageResult(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  result: PageResult,
): Promise<void> {
  const { data } = await supabase
    .from("social_posts")
    .select("page_results")
    .eq("id", postId)
    .maybeSingle();

  const current: PageResult[] = Array.isArray((data as any)?.page_results)
    ? ((data as any).page_results as PageResult[])
    : [];

  const idx = current.findIndex((p) => p.name === result.name);
  const merged: PageResult = {
    ...result,
    completed_at: result.completed_at || new Date().toISOString(),
  };
  if (idx >= 0) current[idx] = merged;
  else current.push(merged);

  await supabase
    .from("social_posts")
    .update({ page_results: current })
    .eq("id", postId);
}

/**
 * Recover stale locks: posts stuck in "publishing" for >10 minutes.
 *
 * Smart recovery using page_results:
 *   - All pending pages → marked failed (timeout)
 *   - All pages succeeded → status="published"
 *   - Some succeeded → status="published" with Partial last_error
 *   - None succeeded → status="failed"
 *
 * Falls back to flat "failed" for posts with no page_results (legacy).
 */
export async function recoverStaleLocks(
  supabase: ReturnType<typeof createClient>,
): Promise<string[]> {
  // Two thresholds: 10 min for fast (text/image) publishes, 20 min for IG videos/Reels
  // because IG's async media processing routinely takes >10 min on first try.
  const cutoffFast = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const cutoffVideo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  // Find all stale candidates (both timestamped and legacy)
  const { data: staleCandidates } = await supabase
    .from("social_posts")
    .select("id, page_results, publishing_started_at, updated_at, platform, content_type, image_url")
    .eq("status", "publishing")
    .or(`publishing_started_at.lt.${cutoffFast},and(publishing_started_at.is.null,updated_at.lt.${cutoffFast})`);

  const recovered: string[] = [];
  for (const post of (staleCandidates || []) as Array<{
    id: string;
    page_results: unknown;
    publishing_started_at: string | null;
    updated_at: string | null;
    platform: string | null;
    content_type: string | null;
    image_url: string | null;
  }>) {
    // For IG videos/reels, hold off until the 20-min cutoff — the upload may still be processing.
    const isIgVideo =
      post.platform === "instagram" &&
      (post.content_type === "reel" ||
        post.content_type === "video" ||
        /\.(mp4|mov|webm)(\?|$)/i.test(post.image_url || ""));
    if (isIgVideo) {
      const startedAt = post.publishing_started_at || post.updated_at;
      if (startedAt && startedAt > cutoffVideo) {
        console.log(`[publishLock] Holding IG video recovery for ${post.id} — still within 20-min window`);
        continue;
      }
    }

    const pageResults: PageResult[] = Array.isArray(post.page_results)
      ? (post.page_results as PageResult[])
      : [];

    if (pageResults.length === 0) {
      // Legacy: no per-page data → flat failed
      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          publishing_lock_id: null,
          publishing_started_at: null,
          last_error: "Publishing timed out — recovered from stale lock. Review before retrying.",
          qa_status: "needs_review",
        })
        .eq("id", post.id);
      recovered.push(post.id);
      continue;
    }

    // Mark any still-pending pages as failed (timeout)
    const finalized = pageResults.map<PageResult>((p) =>
      p.status === "pending"
        ? {
            ...p,
            status: "failed",
            error: "Publishing timed out for this page",
            completed_at: new Date().toISOString(),
          }
        : p,
    );

    const successes = finalized.filter((p) => p.status === "success").map((p) => p.name);
    const failures = finalized.filter((p) => p.status === "failed");

    let finalStatus: "published" | "failed";
    let lastError: string | null;

    if (successes.length === finalized.length) {
      finalStatus = "published";
      lastError = null;
    } else if (successes.length > 0) {
      finalStatus = "published";
      lastError = `Partial: ${failures.map((f) => `Page "${f.name}": ${f.error || "unknown"}`).join("; ")}`;
    } else {
      finalStatus = "failed";
      lastError = failures.map((f) => `Page "${f.name}": ${f.error || "unknown"}`).join("; ")
        || "Publishing timed out — recovered from stale lock. Review before retrying.";
    }

    await supabase
      .from("social_posts")
      .update({
        status: finalStatus,
        publishing_lock_id: null,
        publishing_started_at: null,
        last_error: lastError,
        page_results: finalized,
        qa_status: finalStatus === "failed" ? "needs_review" : undefined,
      })
      .eq("id", post.id);
    recovered.push(post.id);
  }

  return recovered;
}


/**
 * Normalize a page name for matching: trim + lowercase.
 */
export function normalizePageName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
