

# Fix: Facebook Posts Publishing Without Images

## Root Cause

In `supabase/functions/social-cron-publish/index.ts` (lines 336-339), there is a dangerous **text-only fallback**:

```typescript
// Image fallback: retry text-only if image publish failed
if (publishResult.error && post.image_url) {
  publishResult = await publishToFacebook(pageId, pageAccessToken, message, null);
}
```

When the Facebook Graph API rejects the image (expired URL, CORS, format issue), the system **retries without the image** and publishes only the caption. This is exactly what the user sees on Facebook — posts with text but no image.

This fallback does NOT exist in `social-publish` (manual publish), only in the cron function. This means scheduled/approved posts are the ones affected.

## Fix

### `supabase/functions/social-cron-publish/index.ts`
- **Remove lines 336-340** (the text-only fallback block)
- When image publish fails, the error should propagate naturally — the page gets added to `pageErrors` and the post fails explicitly
- Add a log explaining why: `"Facebook image publish failed — will NOT retry without image"`

This is a 5-line removal. No other files need changes.

## Safety
- The `social-publish` function already handles this correctly (no text-only fallback)
- Posts that fail due to image issues will be marked as `failed` with a clear error, allowing the user to fix the image and retry
- No schema or frontend changes needed

