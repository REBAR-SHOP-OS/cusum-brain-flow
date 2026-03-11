

## Auto-generate: 5 unassigned posts with images at fixed time slots

### Problem
Currently "Auto-generate today" creates separate posts per platform (facebook, instagram, linkedin), resulting in 15 posts. The user wants **5 posts only** — one per time slot — with platform set to `unassigned`, so they can later assign platforms manually.

Additionally, the user wants each post to include a **generated image** (currently images are skipped to avoid timeout).

### Changes

#### 1. Frontend — `src/hooks/useAutoGenerate.ts`
- Change default platforms from `["facebook", "instagram", "linkedin"]` to `["unassigned"]`
- This sends a single platform to the edge function, producing exactly 5 posts

#### 2. Edge Function — `supabase/functions/auto-generate-post/index.ts`
- Add `"unassigned"` to `PLATFORM_RULES` with a generic rule (no platform-specific constraints)
- After creating each text post, **generate an image** using Lovable AI (`google/gemini-2.5-flash-image`) with the post's `image_prompt`, then upload to storage and update the post's `image_url`
- This adds ~5 image generation calls but they're sequential per post and each is fast (~5-8s), fitting within the 55s client timeout for 5 posts

#### 3. Calendar display
- The existing calendar already supports `unassigned` platform — posts will show without a platform icon, which is the desired behavior

### Flow after changes

```text
User clicks "Auto-generate today"
  → Edge function generates 5 captions (one AI call)
  → For each post:
      1. Insert as unassigned draft
      2. Generate image via Lovable AI
      3. Upload to storage
      4. Update post with image_url
  → Calendar shows 5 cards at 6:30, 7:30, 8:00, 12:30, 2:30
  → User clicks card → assigns platform(s) → schedules
```

### Files to modify
1. **`src/hooks/useAutoGenerate.ts`** — default platforms → `["unassigned"]`
2. **`supabase/functions/auto-generate-post/index.ts`** — add unassigned platform rule + image generation after each post insert

