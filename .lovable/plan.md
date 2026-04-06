

# Investigation: Why Posts Fail to Publish ("Duplicate")

## Root Cause Found

The duplicate guard in both `social-publish/index.ts` (line 94-136) and `social-cron-publish/index.ts` (line 167-212) is **too aggressive**. Three specific flaws:

### Flaw 1 — Title-only match triggers false positives
```typescript
const sameTitle = pub.title && post.title && pub.title === post.title;
if (sameContent || sameTitle) { // ← title alone blocks!
```
Your auto-generated posts likely share generic titles (e.g. "Daily Rebar Post") across platforms. Two posts with the same title but **different content and images** are incorrectly flagged as duplicates.

### Flaw 2 — Empty page_name = universal overlap
```typescript
const hasPageOverlap = postPages.length === 0 || pubPages.length === 0
  || postPages.some(pg => pubPages.includes(pg));
```
If either post has no `page_name`, the guard assumes overlap — blocking publication even when they target different pages.

### Flaw 3 — UTC date boundaries vs workspace timezone
```typescript
const dayStr = new Date(post.scheduled_date).toISOString().split("T")[0];
// queries with T00:00:00Z / T23:59:59Z
```
For `America/Toronto` (UTC-4), a post scheduled at 11 PM local time falls into the "next day" in UTC. This can cause:
- Posts not finding their actual duplicates (false negatives at edges)
- Posts matching against wrong-day posts (false positives)

## Fix Plan

### 1. Relax duplicate guard — require content+image match, not title alone
In both `social-publish/index.ts` and `social-cron-publish/index.ts`:
- Change `sameContent || sameTitle` → `sameContent` (content + image must both match)
- Title-only match should be a **warning log**, not a block
- This is the primary fix that unblocks the user immediately

### 2. Fix empty page_name overlap logic
- Change: if either side has no pages, treat as **no overlap** (not universal overlap)
- Only block when there's actual page intersection

### 3. Use timezone-aware date boundaries
- Import `getWorkspaceTimezone` 
- Compute local "today" string and UTC boundaries using timezone offset
- Same pattern already applied in `daily-team-report`

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/social-publish/index.ts` | Fix duplicate guard logic (lines 94-136) |
| `supabase/functions/social-cron-publish/index.ts` | Fix duplicate guard logic (lines 167-212) |

## Safety
- No database changes
- Only relaxes an overly strict guard — no risk of actual duplicates since content+image match is still enforced
- Posts that were incorrectly blocked can be retried immediately after deploy

