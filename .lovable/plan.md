

## Fix: Ensure Story Content Type is Reliably Published as Story

### Analysis Summary

After thorough code audit, the entire publish pipeline for Instagram stories is **structurally correct**:
- Frontend passes `content_type: localContentType` to `usePublishPost`
- `usePublishPost` sends `content_type` to the edge function
- Edge function parses it, passes to `publishToInstagram`
- `publishToInstagram` sets `media_type: "STORIES"` when `contentType === "story"`

The most likely cause of the reported issue is a **timing/state problem**: the `content_type` was either not yet saved or was "post" when the publish was triggered, and was changed to "story" afterward.

### Root Cause: No Pre-Publish Content Type Sync

When the user clicks "Publish Now", the code uses `localContentType` from React state. However:
1. There is no explicit `await` to ensure the DB `content_type` matches before the edge function call
2. If `content_type` was changed and the DB update failed silently, the post could be published correctly (via local state) but the DB would still show `content_type: "post"`
3. More critically: if the page refreshed or the review panel was reopened before publishing, `localContentType` reinitializes from `post.content_type` (DB value), which might still be "post"

### Fix (2 files, minimal)

**Patch 1: `src/components/social/PostReviewPanel.tsx`**

Add a defensive `content_type` sync to DB **before** the publish call in the "Publish Now" button handler (~line 969). Before building combos, ensure the DB has the correct content_type:

```typescript
// Defensive: sync content_type to DB before publish
await supabase
  .from("social_posts")
  .update({ content_type: localContentType })
  .eq("id", post.id);
```

This is a single extra update that ensures DB and UI state are synchronized before the publish edge function fires.

**Patch 2: `supabase/functions/social-publish/index.ts`**

Add a log line after parsing to show exactly what `content_type` was received:

```typescript
console.log(`[social-publish] Received: platform=${platform}, content_type=${content_type}, post_id=${post_id}`);
```

This enables debugging future cases.

### Files Changed

| File | Change | Category | Rollback |
|---|---|---|---|
| `src/components/social/PostReviewPanel.tsx` | Add pre-publish `content_type` DB sync | Safe additive | Remove the 3 lines |
| `supabase/functions/social-publish/index.ts` | Add diagnostic log line | Safe additive | Remove the log line |

### What Remains Unchanged
- Instagram STORIES API call logic (already correct)
- Caption stripping for stories (already correct)
- All other publish paths
- No route, schema, or UI changes

