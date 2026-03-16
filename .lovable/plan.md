

# Fix: Story Generation — Add Platform/Page Selectors + Pixel Brain Integration

## Problems

1. **Platform & Page selectors hidden for stories**: The content type, platform, and page selector buttons (lines 637-736) are inside the `else` branch of the `localContentType === "story"` conditional, so they disappear when a post is set to "story" type. Only the "no caption" message shows.

2. **`generate-image` edge function ignores Pixel Brain**: The `ImageGeneratorDialog` (used for story generation) calls `generate-image` which does NOT fetch custom instructions or resource images from the `knowledge` table. The `auto-generate-post` function already has `fetchBrainContext()` but `generate-image` does not.

## Solution

### 1. `src/components/social/PostReviewPanel.tsx` — Show fields for stories too

Move the "Fields Section" (date, content type, platform, pages selectors) **outside** the story/editing conditional so it always renders regardless of content type. The story conditional should only hide the caption/content area, not the metadata fields.

Specifically:
- Keep the story message ("Stories are image/video only") for the content area
- But render the date picker, content type, platform, and pages selectors below it for all content types

### 2. `supabase/functions/generate-image/index.ts` — Fetch Pixel Brain context

Add `fetchBrainContext()` (same logic as in `auto-generate-post`):
- Query `knowledge` table for items with `metadata.agent = "social"`
- Extract custom instructions and resource image URLs
- Inject custom instructions at the top of the `buildAdPrompt` output
- Pass resource images as additional multimodal references to the AI model

## Files to Change

| File | Change |
|------|--------|
| `src/components/social/PostReviewPanel.tsx` | Restructure JSX so fields section renders for all content types including stories |
| `supabase/functions/generate-image/index.ts` | Add `fetchBrainContext()`, inject instructions into prompt, pass resource images |

