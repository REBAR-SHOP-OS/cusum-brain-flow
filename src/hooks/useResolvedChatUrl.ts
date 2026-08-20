import { useEffect, useState } from "react";
import { extractChatFilePath, resolveChatFileUrl } from "@/lib/chatFileUtils";

// Module-level cache so the same legacy public URL is only re-signed once
// per session, no matter how many message bubbles render it.
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function needsResolve(url: string): boolean {
  if (!url) return false;
  // Legacy public URLs (bucket is now private → 404) and expired signed URLs
  // both need to be re-signed. Anything that points at team-chat-files but is
  // not currently a `/object/sign/` URL with a token is treated as stale.
  if (!extractChatFilePath(url)) return false;
  return !/\/object\/sign\/team-chat-files\//.test(url) || !/[?&]token=/.test(url);
}

/**
 * Resolves any team-chat-files URL (legacy `/public/` paths, expired signed
 * URLs, etc.) to a fresh signed URL. Returns the original URL synchronously
 * while resolving in the background; updates once the signed URL is ready.
 *
 * Root-cause fix for "Bucket not found" 404s on chat attachments after the
 * team-chat-files bucket was switched from public to private.
 */
export function useResolvedChatUrl(url: string): string {
  const [resolved, setResolved] = useState<string>(() => cache.get(url) || url);

  useEffect(() => {
    if (!url) return;
    if (!needsResolve(url)) { setResolved(url); return; }
    const cached = cache.get(url);
    if (cached) { setResolved(cached); return; }

    let cancelled = false;
    const existing = inflight.get(url);
    const p = existing || resolveChatFileUrl(url).then((fresh) => {
      cache.set(url, fresh);
      inflight.delete(url);
      return fresh;
    });
    if (!existing) inflight.set(url, p);
    p.then((fresh) => { if (!cancelled) setResolved(fresh); }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  return resolved;
}
