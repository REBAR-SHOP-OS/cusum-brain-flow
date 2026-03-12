

# Fix "Regenerate Caption" Button — Caption-Only AI Regeneration

## Problem
The "Regenerate caption" button currently just opens edit mode (same as "AI Edit"). The user wants it to actually call AI to generate a new caption based on the post's existing image. Additionally, captions must:
- Never contain guarantee-type words (e.g., "guarantee", "guaranteed", "best", "unmatched")
- Be short, promotional/advertising style
- Be in English only

## Changes

### 1. Update `supabase/functions/regenerate-post/index.ts`
Add support for a `caption_only: true` flag in the request body:
- When `caption_only` is true, skip image generation entirely
- Keep the existing image URL
- Pass the image URL to the AI prompt so it can describe the image and write a caption based on it
- Add forbidden words list: "guarantee", "guaranteed", "ensures", "promise", "best", "greatest", "unmatched", "unparalleled", "revolutionary"
- Instruct the AI to write short, punchy, promotional captions (2 sentences max)

### 2. Update `src/components/social/PostReviewPanel.tsx`
Replace the "Regenerate caption" button's `onClick={startEdit}` with a new `handleRegenerateCaption` function:
- Shows a loading state on the button
- Calls `supabase.functions.invoke("regenerate-post", { body: { post_id, caption_only: true } })`
- On success, invalidates the `social_posts` query to refresh
- Shows toast on success/error
- Add `regeneratingCaption` state for loading indicator

### 3. Add forbidden words filter to caption prompt (in edge function)
Add to the caption generation prompt:
```
ABSOLUTELY FORBIDDEN WORDS: guarantee, guaranteed, ensures, promise, best, greatest, 
number one, unmatched, unparalleled, revolutionary, superior, finest
STYLE: Short promotional advertising copy. Maximum 2 sentences. Punchy and direct.
```

