## Goal

Make the pink/orange **Story Generator** icon (Clapperboard, badge "5") learn from reference banner images you upload, so the 5 generated story images match your desired style.

## UX changes — `src/pages/SocialMediaManager.tsx`

Extend the existing Clapperboard popover (currently: Step 1 date → Step 2 product) with a small **References** strip at the top of the popover and a new Step 0:

```
┌──────────────────────────────────────────┐
│ Style References (used by all generations)│
│ [img][img][img][img] [ + Upload ]         │  ← click image to remove
├──────────────────────────────────────────┤
│ Step 1 · Pick a date  → Step 2 · Product │
└──────────────────────────────────────────┘
```

- Multi-upload (PNG/JPG, max 5 active references, ≤4 MB each).
- Per-user (dual-scoping: `user_id`), not company-wide, since it's a personal marketing tool.
- Persists across sessions; same references reused for every story generation until you remove them.

## Data

New table `story_banner_references` (user-scoped, RLS via `auth.uid() = user_id`):

| column | type |
|---|---|
| id | uuid pk |
| user_id | uuid |
| image_url | text (public URL in `social-media-assets`) |
| storage_path | text |
| created_at | timestamptz |

Reuse existing `social-media-assets` bucket under `story-references/{user_id}/...`. GRANT block included per project standard.

Optional small cache table `story_banner_style_cache` keyed by SHA‑256 of the sorted reference URLs → cached style brief text, so we don't re-analyze on every generation.

## Edge function — `supabase/functions/auto-generate-post/index.ts` (story branch only)

1. Load up to 5 active references for the requesting `user_id`.
2. If references exist and no cached brief for this set:
   - Call `google/gemini-3-flash-preview` (vision) with the reference image URLs and ask it to return a tight JSON style brief: `{ composition, typography, palette, mood, do, dont }`.
   - Cache the brief by reference-set hash.
3. Switch story image model to `google/gemini-3-pro-image-preview` when references exist — Gemini accepts image inputs alongside text, so we pass the reference images as visual anchors plus the style brief. Without references, keep current `openai/gpt-image-2` path unchanged.
4. `buildStoryPrompt` gains a `styleBrief` argument injected verbatim, plus a "MATCH THIS STYLE" instruction. Existing baked-in headline + REBAR.SHOP wordmark rules unchanged.
5. Existing per-run SHA-256 dedup loop preserved.

## Out of scope (explicitly not touched)

- Non-story branches of `auto-generate-post`.
- Daily auto-generate cron, Neel approval gate, publishing path.
- Brand Kit editor — references live in their own table, not in Brand Kit.
- Regeneration of past stories — only new generations consume references.

## Verification

- Upload 2–3 banner samples, click Clapperboard → pick date → pick product → 5 placeholders appear.
- After ~30–60s the 5 images render in 2:3 portrait, visibly inspired by the uploaded banner style (palette, typography, composition), each one still unique.
- Remove all references → next run falls back to the current generic story style with no regression.
- Edge function logs: one Gemini vision call per new reference set, cached on subsequent runs.

## Open question

Do you want references to be **per product** (different style memory for "Rebar", "Stirrups", etc.) or **one global style** applied to all products? The plan above assumes one global per-user style; per-product is a small extension (add `product` column + filter).
