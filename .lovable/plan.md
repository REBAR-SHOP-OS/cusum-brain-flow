

## Plan: Fix Auto-Translation Not Triggering

### Root Cause
In `PostReviewPanel.tsx`, when navigating between posts, the `useEffect` cleanup sets `cancelled = true` but the `finally` block at line 286 checks `if (!cancelled) setAutoTranslating(false)` — so `autoTranslating` is never reset to `false`. This permanently blocks the auto-translate for all subsequent posts.

### Changes

**File: `src/components/social/PostReviewPanel.tsx`**

**Fix 1: Reset `autoTranslating` when post changes** (in the sync effect around line 210-253)

Add `setAutoTranslating(false);` at the start of the existing sync effect that fires on `post?.id` change, so it resets the guard before the auto-translate effect evaluates.

**Fix 2: Always reset in cleanup** (line ~290)

Change the cleanup function in the auto-translate `useEffect` to also reset `autoTranslating`:
```typescript
return () => { 
  cancelled = true; 
  setAutoTranslating(false); 
};
```

**Deploy: Ensure `translate-caption` edge function is deployed** — redeploy to confirm it's live.

### Result
Every time a post is opened in the review panel, if it has no Persian translation, the system will call `translate-caption` with the caption text and display the result. Switching between posts will correctly reset and re-trigger translation.

