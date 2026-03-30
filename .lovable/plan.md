

# Fix: Persian Translation Never Saved to DB in Auto-Generate Flow

## Problem
The "🔒 Internal reference only" section always shows "ترجمه‌ای موجود نیست" for auto-generated posts because the Persian translation is stripped before saving.

## Root Cause
In `supabase/functions/auto-generate-post/index.ts`:

1. The AI prompt correctly asks for `farsi_translation` as a separate JSON field (line 317)
2. The AI returns it in `post.farsi_translation`
3. **Line 391**: `content: stripPersianBlock(post.content || "")` — strips any Persian from `content`
4. **`post.farsi_translation` is completely ignored** — it's logged at line 609 but never appended to the saved `content`

The `stripPersianBlock` function was likely added to prevent Persian from leaking into published captions, but it inadvertently prevents the Persian block from ever reaching the DB.

## Fix

### File: `supabase/functions/auto-generate-post/index.ts`

**Change line 391** — Append `farsi_translation` to the clean content instead of discarding it:

```typescript
// Before (line 391):
content: stripPersianBlock(post.content || ""),

// After:
content: stripPersianBlock(post.content || "") + 
  (post.farsi_translation ? "\n\n" + post.farsi_translation : ""),
```

This ensures:
- English caption is cleaned of any accidentally embedded Persian (via `stripPersianBlock`)
- The structured `farsi_translation` field (which contains the `---PERSIAN---` separator) is appended back
- `PostReviewPanel` can then parse the `---PERSIAN---` block and display it in the internal reference section
- The publish flow already strips `---PERSIAN---` before publishing, so no risk of Persian leaking to social platforms

## Files Changed
- `supabase/functions/auto-generate-post/index.ts` — append `farsi_translation` to saved content

