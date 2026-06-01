## Goal
Add a dedicated **"Regenerate Story"** icon button in the post detail panel that — only when the post is a 9:16 Story — regenerates a brand-new image at the exact same 9:16 (1080×1920) dimensions, preserving caption, title, and hashtags.

## Why a new button (vs reusing "Regenerate image")
The existing `Regenerate image` button works, but:
- It's labeled generically, so users don't trust it will keep portrait dimensions on Story posts.
- The user wants a clear, story-specific affordance that visually mirrors "Auto Generate Story" but acts on the current card.

The backend (`supabase/functions/regenerate-post/index.ts`, `image_only: true` branch) already hard-locks output to 9:16 (`imageAspectRatio: "9:16"` + `cropToAspectRatioStrict` + the explicit "OUTPUT CANVAS MUST BE 9:16 STORY PORTRAIT" prompt). No backend changes needed.

## Changes

### 1. Frontend — `src/components/social/PostReviewPanel.tsx`
In the visual-actions button row (around line 996, next to **Auto Generate Story** / **Repost**), add a new button:

- **Visible only when** `isStory` is `true` (post.content_type === "story" OR localContentType === "story").
- Icon: `Smartphone` + `RefreshCw` (or just `RefreshCw` with smartphone-style outline label).
- Label: **"Regenerate Story"**.
- On click:
  - Set a local `regeneratingStory` state.
  - Call `invokeEdgeFunction("regenerate-post", { post_id: post.id, image_only: true }, { timeoutMs: 120000 })`.
  - Invalidate `social_posts` query.
  - Toast: "New 9:16 story image generated — caption preserved."
  - On error, show destructive toast.

The existing **"Regenerate image"** button stays unchanged (no behavior change for non-story posts).

### 2. Regression test — `tests/regression/social/regenerate-story-9x16.test.ts`
Static checks:
- `PostReviewPanel.tsx` contains a "Regenerate Story" button gated by `isStory`.
- That button's onClick invokes `regenerate-post` with `image_only: true`.
- `supabase/functions/regenerate-post/index.ts` still enforces `imageAspectRatio: "9:16"` in the `image_only` branch (guard against future regressions stripping the 9:16 lock).

### 3. Memory
No new memory entry required — covered by existing **Story 9:16 hard rule** and **Neel Approval Gate** rules. The button respects both (regeneration does not flip `neel_approved`).

## Out of scope
- No changes to the existing `Regenerate image` button.
- No changes to non-story aspect handling (separate concern).
- No backend changes — `image_only` already produces 9:16.
- No caption regeneration; image-only.
