/**
 * Resolve the *displayed* status of a social post.
 *
 * The DB column `status` can lie temporarily when a publish run crashed or
 * was abandoned: it sits at "publishing" until the cron stale-lock recovery
 * (10–20 min) flips it. We don't want the UI to lie that long.
 *
 * This pure helper derives the real status from `page_results` + `updated_at`,
 * so the calendar card flips to Published / Failed within seconds of the real
 * outcome — never indefinitely stuck on "Publishing".
 */

export type DisplayStatus =
  | "published"
  | "scheduled"
  | "draft"
  | "declined"
  | "pending_approval"
  | "publishing"
  | "failed";

export interface PageResultEntry {
  name?: string;
  status?: "pending" | "success" | "failed";
  error?: string;
}

export interface ResolvableSocialPost {
  status: DisplayStatus | string;
  page_results?: unknown;
  updated_at?: string | null;
  image_url?: string | null;
  content_type?: string | null;
}

export interface ResolvedDisplay {
  displayStatus: DisplayStatus;
  partial: boolean;
  isStale: boolean;
}

const IMAGE_STALE_MS = 3 * 60 * 1000;   // 3 min — image posts must resolve fast
const VIDEO_STALE_MS = 20 * 60 * 1000;  // 20 min — IG video / Reels can legitimately take longer
const MIXED_FINALIZE_MS = 60 * 1000;    // 1 min — mixed results: treat as published(partial)

function readPageResults(raw: unknown): PageResultEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is PageResultEntry => !!x && typeof x === "object");
}

function isVideoPost(post: ResolvableSocialPost): boolean {
  if (post.content_type === "reel" || post.content_type === "video") return true;
  const url = post.image_url || "";
  return /\.(mp4|m4v|mov|webm|mkv)(\?|$)/i.test(url);
}

export function resolveDisplayStatus(post: ResolvableSocialPost): ResolvedDisplay {
  const base = (post.status as DisplayStatus) || "draft";
  if (base !== "publishing") {
    return { displayStatus: base, partial: false, isStale: false };
  }

  const results = readPageResults(post.page_results);
  const ageMs = post.updated_at
    ? Date.now() - new Date(post.updated_at).getTime()
    : 0;
  const staleCutoff = isVideoPost(post) ? VIDEO_STALE_MS : IMAGE_STALE_MS;

  if (results.length > 0) {
    const successes = results.filter((p) => p.status === "success");
    const failures = results.filter((p) => p.status === "failed");
    const pending = results.filter((p) => p.status === "pending");

    if (failures.length === results.length) {
      return { displayStatus: "failed", partial: false, isStale: false };
    }
    if (successes.length === results.length) {
      return { displayStatus: "published", partial: false, isStale: false };
    }
    // Mixed: some success + some failed/pending.
    if (successes.length > 0 && ageMs > MIXED_FINALIZE_MS) {
      return { displayStatus: "published", partial: true, isStale: false };
    }
    // No success yet but all-pending and gone stale → failed.
    if (successes.length === 0 && pending.length > 0 && ageMs > staleCutoff) {
      return { displayStatus: "failed", partial: false, isStale: true };
    }
  } else if (ageMs > staleCutoff) {
    // No page_results recorded at all and we've been "publishing" past the
    // stale window — treat as failed so the operator sees red and can retry.
    return { displayStatus: "failed", partial: false, isStale: true };
  }

  return { displayStatus: "publishing", partial: false, isStale: false };
}
