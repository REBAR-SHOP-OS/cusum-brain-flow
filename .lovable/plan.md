

# Fix: Page Status Indicators — Green = Published, Red = Not Published

## Problem
Currently, page indicators in the calendar cards show neutral gray circles (○) for scheduled/draft/pending posts. The user wants a clear monitoring view: **green = published, red = not published**. No gray/neutral state.

## Change

**File: `src/components/social/SocialCalendar.tsx`**

Update `PageStatusDropdown` (lines 176-184) to use a binary logic:

- `post.status === "published"` AND page not in `last_error` → **green checkmark**
- Partial success: pages NOT mentioned in error → **green**, pages in error → **red**
- Everything else (draft, scheduled, pending, declined, failed, publishing) → **red X**

Replace the current conditional block:
```tsx
// Current: shows gray circles for non-published/non-failed
{post.status === "published" ? (
  <CheckCircle2 className="w-3 h-3 text-green-500" />
) : ps.failed ? (
  <XCircle className="w-3 h-3 text-destructive" />
) : hasFailed ? (
  <CheckCircle2 className="w-3 h-3 text-green-500" />
) : (
  <Circle className="w-3 h-3 text-muted-foreground" />  // ← gray neutral
)}
```

With:
```tsx
// New: binary — green if published successfully, red otherwise
{(post.status === "published" && !ps.failed) || 
 (hasFailed && !ps.failed) ? (
  <CheckCircle2 className="w-3 h-3 text-green-500" />
) : (
  <XCircle className="w-3 h-3 text-destructive" />  // ← always red if not published
)}
```

This removes the gray `Circle` entirely — every page is either green (published) or red (not published), making the monitoring purpose clear.

