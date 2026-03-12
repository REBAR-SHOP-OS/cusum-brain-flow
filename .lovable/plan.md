

# Fix: Facebook Publishing Failure (#200 Permission Error)

## Problem
Facebook posts fail with error #200 ("requires pages_read_engagement and pages_manage_posts permission") even though the user has connected Facebook and page tokens are stored. The pre-flight check passes (it only verifies the token can read page info) but the actual publish call fails because the stored page token lacks publish permissions.

## Root Cause
The stored page tokens become stale or lose permissions over time (Facebook can revoke granular permissions, or the token was stored before permissions were fully granted). The current pre-flight check (`?fields=id,name`) is insufficient — it passes with any valid token regardless of publish permissions.

## Fix — Two Changes

### 1. Add Page Token Refresh Before Publishing
In both `social-publish/index.ts` and `social-cron-publish/index.ts`, before attempting to publish, refresh the page token by calling `/me/accounts` with the user's long-lived token. This guarantees a fresh page token with current permissions. If refresh fails, fall back to the stored token.

Add a shared helper function in both files:

```typescript
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
      return data.access_token || null;
    }
  } catch {}
  return null;
}
```

### 2. Improve Pre-flight to Check Publish Permission
Replace the simple `?fields=id,name` pre-flight with a permission-aware check that calls `/{page_id}?fields=id,name,access_token` and then verifies the token can actually reach the feed endpoint. If it detects a permission issue, attempt token refresh before failing.

### Files Modified
- `supabase/functions/social-publish/index.ts` — Add token refresh before Facebook publish, improve pre-flight
- `supabase/functions/social-cron-publish/index.ts` — Same token refresh logic for scheduled/cron publishes
- Both functions will also update the stored page token in `user_meta_tokens` after a successful refresh, preventing repeated refresh calls

