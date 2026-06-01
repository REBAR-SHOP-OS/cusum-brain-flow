## Goal

Make Style References **per product**: before uploading a banner, ask which product it belongs to. Each generation then loads only the references for the selected product.

## UX — `StoryBannerReferences.tsx` + `SocialMediaManager.tsx`

The Style References strip becomes product-scoped:

```
┌──────────────────────────────────────────────────┐
│ Style references  ·  Product: [ Rebar ▼ ]   2/5 │
│ Upload sample banners for THIS product.          │
│ [img][img] [ + Upload ]                          │
└──────────────────────────────────────────────────┘
Step 1 · Pick a date
Step 2 · Product  ← auto-syncs with reference selector
```

- A product dropdown sits at the top of the references panel (same product list already used in Step 2: Rebar, Stirrups, Mesh, etc.).
- Clicking **+ Upload** when no product is selected shows a toast: *"Pick a product first"* and opens the dropdown — no file picker until a product is chosen.
- The grid shows only references for the currently selected product. Switching product reloads the grid.
- The product chosen here pre-selects Step 2's product (and vice versa) so the user never uploads under one product and generates under another.

## Data

Add `product text not null` to `story_banner_references` (migration):
- Backfill existing rows with `'general'`.
- New index on `(user_id, product, created_at)`.
- Same RLS, same bucket path → `story-references/{user_id}/{product}/{uuid}.{ext}`.

Cache table `story_banner_style_cache` stays as-is — the `reference_set_hash` already changes when the reference set changes, which naturally happens per product.

## Edge function — `auto-generate-post/index.ts` (story branch only)

- Load references filtered by `user_id` AND the requested `product` (already passed in the body).
- If a product has zero references → fall back to the current generic story style (no Gemini vision call, no style brief).
- Everything else (hash → cache → style brief → Gemini pro image with refs) stays the same.

## Out of scope

- Cross-product reference sharing / "apply to all products" toggle.
- Renaming products or editing the product list.
- Migrating old generations.

## Verification

- Open Clapperboard → product dropdown defaults to empty → click + → toast asks to pick product.
- Pick "Rebar" → upload 2 banners → switch to "Stirrups" → grid is empty → upload 1 banner.
- Switch back to "Rebar" → still shows the 2 Rebar banners.
- Generate for Rebar on June 2 → 5 images match Rebar references.
- Generate for Stirrups → 5 images match the single Stirrups reference (different style).
- Remove all Rebar refs → next Rebar run falls back to generic style.
