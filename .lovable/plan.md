

## Two Features: Video Badge on Calendar Cards + Cover Image Upload for Video Posts

### What the user wants

1. **Video icon on calendar cards** — any post with video content (`image_url` ending in `.mp4`) should show a small video icon badge on its calendar card
2. **Cover image upload** — in the review panel, when a post has a video, add a button (in the area circled in red, next to "Upload Image") to upload a cover/thumbnail image for social media preview (Instagram feed shows a cover frame, not the video itself)

### Problem

- The DB `social_posts` table has no `cover_image_url` column — we need a migration to add it
- Calendar cards currently show no indicator of video vs image content
- The review panel has no cover image upload flow

---

### Patch 1: Add `cover_image_url` column to `social_posts`

**Migration**: `ALTER TABLE social_posts ADD COLUMN cover_image_url text;`

- Nullable, no default needed
- No RLS change — existing policies cover all columns
- No breaking change — column is optional

### Patch 2: Video badge on calendar cards

**File**: `src/components/social/SocialCalendar.tsx`

- Import `Video` icon from lucide-react
- After the platform icon row (line ~221), check if `firstPost.image_url?.endsWith(".mp4")`
- If true, render a small `<Video className="w-3 h-3" />` badge next to the platform icon
- Minimal — one conditional icon, no layout change

### Patch 3: Cover image upload button in PostReviewPanel

**File**: `src/components/social/PostReviewPanel.tsx`

- When `isVideo` is true, show a new "Upload Cover" button in the media actions area (next to "Upload Image")
- On file select, upload via `uploadSocialMediaAsset(blobUrl, "image")` then save to `cover_image_url` on the post
- If `cover_image_url` exists, show a small thumbnail preview above/below the video player
- The cover image is for Instagram feed display (thumbnail frame)

### Patch 4: Pass cover_image_url to social-publish

**File**: `supabase/functions/social-publish/index.ts`

- When publishing a video post with `cover_image_url`, pass it as the `cover_url` parameter to the Instagram API (Graph API supports this)
- This is additive — if no cover_image_url, behavior is unchanged

---

### Files Changed

| File | Change | Category |
|---|---|---|
| Migration | Add `cover_image_url text` to `social_posts` | Schema additive |
| `src/components/social/SocialCalendar.tsx` | Video badge icon on cards | Safe additive |
| `src/components/social/PostReviewPanel.tsx` | Cover image upload button + preview | Safe additive |
| `supabase/functions/social-publish/index.ts` | Pass cover_url for video posts | Safe additive |

### Regression Risk
Low — all changes are additive. Existing image posts unaffected. Video posts gain optional cover image. Calendar cards gain a small icon.

