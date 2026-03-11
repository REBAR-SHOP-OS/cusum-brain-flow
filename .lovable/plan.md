

## Delete Unassigned Card When Platforms Are Assigned and Scheduled

### Problem
When a Pixel-approved post (or auto-generated post) appears as a `?` card and the user assigns platforms + schedules it, the `schedule-post` edge function creates **clones** for each platform×page combo. But the **original unassigned post remains** in the database, causing a duplicate `?` card to persist alongside the new platform cards.

### Solution
Modify the `schedule-post` edge function: after cloning is complete, if the **original post was `unassigned`**, delete it instead of updating it. If there are no extra_combos (single platform), update it normally as today.

### Changes

#### 1. Edge Function: `supabase/functions/schedule-post/index.ts`

**Current behavior**: Always updates the primary post with the first platform, then clones for extras.

**New behavior**:
- If the original post's platform is `unassigned` AND there are combos to schedule:
  - Create clones for ALL platform×page combos (including the first one, which currently updates the primary)
  - Delete the original unassigned post
- If the original post is NOT unassigned, or there are no extra_combos: keep current behavior (update primary, clone extras)

```text
schedule-post flow:

  Was original "unassigned"?
    ├── YES + has platform assignments
    │     ├── Clone for EVERY platform×page combo (primary + extras)
    │     └── DELETE original unassigned post
    └── NO (or no combos)
          ├── UPDATE primary post with first platform
          └── Clone extras (existing behavior)
```

#### 2. Client: `src/components/social/PostReviewPanel.tsx`

When the Schedule button is clicked and the post is currently `unassigned`:
- Include ALL platform×page combos as `extra_combos` (not just the "rest")
- The edge function will handle creating all clones and deleting the original

This requires a small change in the Schedule button handler (around line 709-716): if `post.platform === "unassigned"`, pass all combos as `extra_combos` and set a flag like `delete_original: true`.

### Files to Change
1. `supabase/functions/schedule-post/index.ts` — Add logic to detect unassigned original, clone all combos, delete original
2. `src/components/social/PostReviewPanel.tsx` — Pass all combos when original is unassigned

