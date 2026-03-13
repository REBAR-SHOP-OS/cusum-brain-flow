

# Fix: Auto-Generate Reliability & Missing Images

## Root Cause Analysis

**Two critical issues found:**

### 1. Client Timeout (55s) vs Server Processing Time (~80s)
The `useAutoGenerate.ts` hook has a 55-second `AbortController` timeout. However, the `auto-generate-post` edge function generates 5 images **sequentially** (each ~10-15s), taking 60-80 seconds total. When the client aborts:
- The error toast fires ("Generation timed out")
- `queryClient.invalidateQueries` **never runs** (it's in the success path)
- The edge function **continues server-side** and actually succeeds
- The user sees posts without images because the cache was never refreshed

### 2. Race Condition: Posts Inserted Before Images
The edge function inserts posts with `image_url: null` first, then generates and uploads images one by one, updating each post. If the client fetches posts during this window, posts appear imageless.

**Evidence from DB:** All `pending_approval` posts currently have `image_url` set — confirming images ARE generated, but the client misses the updates.

## Solution

### Changes to `src/hooks/useAutoGenerate.ts`
1. **Increase timeout** from 55s to 120s (matching the edge function's realistic completion time)
2. **Add post-completion polling**: After the edge function returns (success or timeout), schedule 2-3 delayed `invalidateQueries` calls to pick up late image updates
3. **On timeout, still invalidate queries** — since the server continues working, the posts exist and will eventually have images

### Changes to `supabase/functions/auto-generate-post/index.ts`
1. **Generate images in parallel** (2 at a time) instead of sequentially — cut total time from ~80s to ~40s
2. **Return early with post IDs** after inserting all text-only posts, then continue image generation asynchronously using `waitUntil` pattern (Deno doesn't support this, so parallel batching is the practical fix)

### Changes to `src/pages/SocialMediaManager.tsx`
1. After auto-generate returns, add a delayed re-fetch (5s, 15s, 30s) to catch any images that were still being uploaded

## Technical Detail

```text
Current flow:
  Client ──55s timeout──> ABORT
  Server: insert post1 → gen img1 (10s) → insert post2 → gen img2 (10s) → ... → post5 (total ~80s)
  Client sees: posts without images, error toast

Fixed flow:
  Client ──120s timeout──> wait
  Server: insert all 5 posts → gen img1+img2 parallel → gen img3+img4 parallel → gen img5 (total ~40s)
  Client: success toast + invalidate + scheduled re-fetches at 5s/15s
```

## Files
- `src/hooks/useAutoGenerate.ts` — increase timeout, add polling re-fetches
- `supabase/functions/auto-generate-post/index.ts` — parallelize image generation (2 concurrent)
- `src/pages/SocialMediaManager.tsx` — add delayed re-fetch after generate

