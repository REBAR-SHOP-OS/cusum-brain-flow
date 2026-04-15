

## Plan: Auto-Generate Persian Translation When Missing

### Problem
Many existing posts were created before the Persian translation feature was added. When viewing these posts in the review panel, the "Internal Reference" section shows "ترجمه‌ای موجود نیست" for both image text and caption translation.

### Root Cause
- New posts (via `ai-agent` and `regenerate-post`) already include `---PERSIAN---` blocks with translations
- Old posts in the database lack this block entirely
- The UI simply displays "no translation" when the block is missing — it never attempts to generate one

### Solution
Add auto-translation in the PostReviewPanel: when a post loads and has no Persian translation, automatically call the AI to translate the English caption and image text to Persian, then update the post content in the database.

### Changes

**File 1: `src/components/social/PostReviewPanel.tsx`**

Add a `useEffect` that triggers when a post loads with empty `persianImageText` and `persianCaptionText`:
- Call a new lightweight edge function `translate-caption` (or reuse `translate-message`) to translate the English caption to Persian
- On success, update the post's `content` field in the DB by appending the `---PERSIAN---` block
- Update local state to display the translation immediately
- Show a subtle loading indicator while translating

**File 2: `supabase/functions/translate-caption/index.ts`** (new edge function)

A simple edge function that:
- Accepts `{ caption: string, imageText?: string }`
- Calls the AI gateway to translate both to fluent Persian (same quality instructions as regenerate-post)
- Returns `{ captionFa: string, imageTextFa?: string }`

This is kept separate from `translate-message` because it needs the specific advertising-quality Persian translation prompt, not general translation.

**File 3: `src/components/social/PixelPostCard.tsx`**

Same logic: if `captionTranslation` is empty when the card renders, show a "Translating..." indicator and trigger the same translation flow.

### What Stays the Same
- All new post generation (ai-agent, regenerate-post) already produces Persian — no changes needed
- The `stripPersian` function in publish flows continues to remove Persian before publishing
- No changes to the database schema

### Result
Every post will always show its Persian translation. For new posts it's generated at creation time. For old posts without translations, it's auto-generated on first view and saved back to the DB so it only needs to be done once.

