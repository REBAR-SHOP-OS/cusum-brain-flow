## Goal

The "5" icon next to **Add Card** must produce **stories only**:
- 5 cards on the picked date for the picked product
- Each card flagged as a Story (`content_type = "story"`)
- Each card has **only an image** in 9:16 portrait, **no caption / no hashtags / no slogan overlay**
- Image must depict **only the chosen product** (no generic construction scenes)

The existing 2-step popover (calendar → product list) stays. Only the generation pipeline changes.

## Changes

### 1. `src/hooks/useAutoGenerate.ts`
- Add optional params: `mode?: "story" | "post"` (default `"post"`), `product?: string`.
- When `mode === "story"`:
  - Placeholder rows insert with `content_type: "story"`, `title: product`, `content: ""`, `hashtags: []`.
  - Forward `mode` and `product` in the `auto-generate-post` invoke body.

### 2. `supabase/functions/auto-generate-post/index.ts`
- Read `mode` and `product` from body.
- When `mode === "story"`:
  - Skip the full Pixel system prompt / JSON caption generation entirely.
  - Build 5 image prompts locally (one per `TIME_SLOTS` slot) — each prompt:
    - Pins the subject to the single chosen `product` only (no city/skyline/crane filler).
    - Requests **9:16 vertical / portrait framing**, full-bleed Instagram/Facebook Story composition, safe top/bottom margins.
    - Uses 5 different camera angles / lighting setups from `VISUAL_STYLES` filtered to product-centric ones (macro, warehouse product shot, workshop close-up, dramatic lighting, blueprint-on-bench).
    - Keeps the existing logo watermark rule (logo image attached as reference).
    - Adds: "No text overlay, no slogan, no caption inside the image."
  - Update the 5 placeholder rows with `image_url` only — do **not** overwrite `title`, `content`, `hashtags`, or `content_type`.
  - Skip approval-record creation block (stories stay as drafts owned by user) — same path as current placeholder-only flow.

### 3. `src/pages/SocialMediaManager.tsx`
- In the "5 stories" popover product-button `onClick`, change the `generatePosts` call to:
  ```ts
  generatePosts({
    mode: "story",
    product,
    platforms: ["unassigned"],
    scheduledDate: format(storyPickedDate, "yyyy-MM-dd"),
  });
  ```
- Drop the previous `customInstructions` / `themes` payload — the edge function owns the story prompt now.

## Out of scope
- No DB migration (`content_type` column already exists on `social_posts`).
- No new edge function.
- Image API still Gemini 2.5 flash image via chat-completions (9:16 framing is conveyed in the prompt — Gemini image doesn't accept a `size` param).
- No change to "Add Card", "Generating…", approvals, or the rest of the page.

## Verification
- Click "5" → pick date → pick "Rebar Stirrups" → 5 cards appear at the 5 placeholder times on that date, each card empty caption, image is a vertical 9:16 stirrups close-up with logo watermark, `content_type = 'story'` in DB.
