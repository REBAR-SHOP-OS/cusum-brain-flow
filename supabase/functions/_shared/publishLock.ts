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
 * Recover stale locks: posts stuck in "publishing" for >10 minutes.
 * Clears lock fields and resets to "scheduled".
 */
export async function recoverStaleLocks(
  supabase: ReturnType<typeof createClient>,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("social_posts")
    .update({
      status: "failed",
      publishing_lock_id: null,
      publishing_started_at: null,
      last_error: "Publishing timed out — recovered from stale lock. Review before retrying.",
      qa_status: "needs_review",
    })
    .eq("status", "publishing")
    .lt("publishing_started_at", cutoff)
    .select("id");

  // Also recover posts stuck in publishing without a lock timestamp (legacy)
  const { data: staleLegacy } = await supabase
    .from("social_posts")
    .update({
      status: "failed",
      publishing_lock_id: null,
      publishing_started_at: null,
      last_error: "Publishing timed out — recovered from stale lock (legacy). Review before retrying.",
      qa_status: "needs_review",
    })
    .eq("status", "publishing")
    .is("publishing_started_at", null)
    .lt("updated_at", cutoff)
    .select("id");

  const recovered = [
    ...(stale || []).map(p => p.id),
    ...(staleLegacy || []).map(p => p.id),
  ];

  return recovered;
}

/**
 * Normalize a page name for matching: trim + lowercase.
 */
export function normalizePageName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
