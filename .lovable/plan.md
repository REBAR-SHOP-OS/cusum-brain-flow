

# Fix Social Media Publishing System — Critical Bugs

## Problems Identified

### 1. IG Polling Returns `status=undefined` (ROOT CAUSE of IG failures)
**Evidence**: Logs show 30 consecutive `status=undefined` polls → timeout → fails.
**Root cause**: Instagram container status polling requires the **page access token**, but the code uses the user's long-lived token when no page-specific token exists. The user's token can create the container but can't poll its status. Additionally, for Instagram in `social-cron-publish`, `refreshPageToken` is never called (unlike Facebook), so the page token is stale or missing.

### 2. Race Condition — No Atomic Lock
Cron and manual publish can both pick up the same post. Current guard (`status = "publishing"` check) is not atomic — two concurrent calls can both read `scheduled` before either writes `publishing`.

### 3. Remaining Fallbacks
Line 195 (`social-publish`) and line 272 (`social-cron-publish`): when `individualPages` is empty, code falls back to `pages[0]?.name` — violating the no-fallback rule.

### 4. Owner-Only Token Policy Not Enforced
Both functions have "any team member" token fallback which user wants removed.

---

## Changes

### Migration: Add `publishing_lock_id` + `publishing_started_at`
```sql
ALTER TABLE public.social_posts 
  ADD COLUMN IF NOT EXISTS publishing_lock_id uuid,
  ADD COLUMN IF NOT EXISTS publishing_started_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_social_posts_publishing_lock 
  ON public.social_posts(status, publishing_started_at);
```

### File 1: `supabase/functions/_shared/publishLock.ts` (NEW)
Shared atomic lock utility:
- `acquirePublishLock(supabase, postId)` — atomically sets `status='publishing'`, `publishing_lock_id=uuid`, `publishing_started_at=now()` only if current status is `scheduled` or `draft`. Returns `{ locked: true, lockId }` or `{ locked: false, reason }`.
- Uses Supabase `.update().eq("id", postId).eq("status", "scheduled")` which is atomic at DB level.
- `releasePublishLock(supabase, postId, lockId, finalStatus, error?)` — sets final status only if `publishing_lock_id` matches.

### File 2: `supabase/functions/social-cron-publish/index.ts`
1. **Remove team token fallback** — if post owner has no token, fail with explicit error.
2. **Remove `pages[0]` fallback** (line 272) — if no `page_name` set, fail with "No pages assigned".
3. **Use `acquirePublishLock`** instead of non-atomic status check+update.
4. **Fix Instagram page token**: call `refreshPageToken(userLongLivedToken, pageId)` before IG publish (same as FB does), so IG container polling uses a valid page token.
5. **Use `releasePublishLock`** for final status update (published/failed).
6. **Add normalized page matching**: `pages.find(p => p.name?.trim().toLowerCase() === targetPageName.trim().toLowerCase())`.
7. **Enhanced logging**: log `post_id, platform, lock_id, target_pages, available_pages, matched_ig` at each step.

### File 3: `supabase/functions/social-publish/index.ts`
1. **Remove team token fallback** (lines 160-168).
2. **Remove `pages[0]` fallback** (line 195) — fail if no pages assigned.
3. **Use `acquirePublishLock`** before publishing.
4. **Fix Instagram page token**: add `refreshPageToken` call before IG publish.
5. **Use `releasePublishLock`** for final status.
6. **Normalized page matching**: case-insensitive trim match.
7. **Enhanced logging**.

### File 4: Frontend `src/hooks/usePublishPost.ts`
- No structural changes needed. The existing 120s timeout + retry polling is fine.
- Add `page_name` to the `publishPost` params already includes it — no change.

### No changes to `PostReviewPanel.tsx` or `schedulePost.ts`
The frontend already passes `page_name` correctly. The fixes are all backend.

---

## Key Technical Details

### Why IG Polling Fails
```text
Instagram API flow:
1. POST /{ig-account-id}/media → creates container (works with user token)
2. GET /{container-id}?fields=status_code → needs PAGE token
3. POST /{ig-account-id}/media_publish → publishes (works with page token)

Current code passes user's long-lived token to step 2 → returns empty status_code → undefined
Fix: refresh page token via Graph API before IG publish, same as we do for Facebook
```

### Atomic Lock Pattern
```typescript
// Atomic: only one caller wins
const { data } = await supabase
  .from("social_posts")
  .update({ status: "publishing", publishing_lock_id: lockId, publishing_started_at: new Date().toISOString() })
  .eq("id", postId)
  .in("status", ["scheduled"])  // Only if still scheduled
  .select("id")
  .maybeSingle();
if (!data) return { locked: false }; // Another process already took it
```

### Stale Lock Recovery (already exists, keep it)
The existing 10-minute recovery in cron resets stale `publishing` posts back to `scheduled`. This stays but now also clears `publishing_lock_id`.

---

## Safety
- All changes are additive — new columns, new shared file
- Existing `publishedFbPageIds`/`publishedIgIds` Sets remain as secondary dedup
- DB trigger `block_social_publish_without_qa` unchanged
- Partial-published behavior preserved (at least 1 page succeeds → published)
- No frontend changes needed

