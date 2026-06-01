## Goal

Make the existing pink/orange "5" icon next to **Add Card** a 2-step popover:

1. Pick a date (calendar).
2. Pick one of 9 products.
3. Auto-generate **5 Story cards** for that date, each with a product-specific AI image (9:16) and a matching caption.

## Scope

Frontend-only change in `src/pages/SocialMediaManager.tsx`, plus a tiny addition to the prompt sent to the existing `auto-generate-post` edge function via `useAutoGenerate.generatePosts(...)`. No DB migrations, no new edge function, no schema changes.

## UX flow

```text
[click 5-icon] → Popover step 1: Calendar (single date)
              → Popover step 2: Product list (9 buttons, scrollable)
              → Toast "Generating 5 Story cards for <Product>…"
              → Week jumps to the chosen date; 5 placeholder cards appear,
                then fill in with images + captions as generation completes.
```

Products (fixed list, in this order):

- Rebar Stirrups
- Rebar Cages
- Rebar Hooks
- Rebar Dowels
- Circular Ties / Bars
- Fiberglass Rebar (GFRP)
- Wire Mesh
- Rebar Tie Wire
- Rebar Accessories

Cancel/back: a small "← Back to date" link in step 2 returns to the calendar. Closing the popover resets both selections.

## Technical details

1. **`src/pages/SocialMediaManager.tsx`** (only file touched in UI):
   - Convert the existing 5-stories `<Popover>` (currently at ~lines 402–440) from uncontrolled to controlled with `useState` for `open`, `pickedDate`, and a new `STORY_PRODUCTS` constant (the 9 names above).
   - Step 1 = current `<Calendar mode="single">`. `onSelect` only stores `pickedDate` — no DB writes yet.
   - Step 2 = a vertical list of 9 `<Button variant="ghost">` rows. Clicking one:
     1. Closes the popover, resets local state.
     2. Calls `setWeekStart(startOfWeek(pickedDate, { weekStartsOn: 1 }))`.
     3. Calls the existing `generatePosts({...})` from `useAutoGenerate` (already wired into the component — re-add it to the destructure if missing) with:
        ```ts
        generatePosts({
          platforms: ["unassigned"],
          themes: [productName],
          scheduledDate: format(pickedDate, "yyyy-MM-dd"),
          customInstructions:
            `Create 5 Instagram/Facebook STORY cards (9:16 portrait) for the product "${productName}". ` +
            `Each card must feature a real-looking product photo of ${productName} on a clean construction-site background, ` +
            `with a short punchy caption (max 12 words) highlighting one distinct benefit per card. ` +
            `Keep the REBAR.SHOP logo. Output 5 unique angles.`,
        });
        ```
   - Remove the inline 5×`createPost.mutate` loop from the current implementation (it produces blank cards) — replaced by `generatePosts` which already creates 5 placeholder rows + fills them with AI image + caption (logic in `useAutoGenerate.ts` lines 60–115). This satisfies the dead-code-removal rule.

2. **No edge-function change required.** `auto-generate-post` already accepts `customInstructions` (line 196) and uses it in the image+caption prompt (lines 212–215). The 9:16 story framing is conveyed through `customInstructions`. We are not adding a new `aspect` param to the API.

3. **`content_type = "story"`** is **not** set by `auto-generate-post` today; this plan does not change that (out of scope). The cards land as drafts the user can still tag as Story manually if needed. If you want auto-tagging, say so and I'll add a tiny post-insert update in `useAutoGenerate` behind a new option — but that's an extra step, not in this plan.

## Out of scope

- No changes to the existing **Add Card** button, the auto-generate brain prompt for non-story posts, the publish pipeline, or any DB tables.
- No new edge function, no aspect-ratio plumbing through the API.
- No automatic `content_type='story'` stamping (call this out — ask if you want it added).

## Verification

- Click the 5-icon → calendar appears. Pick a date → product list appears. Pick "Rebar Stirrups".
- Toast "Posts generated 🎨" within ~30–60s; week view jumps to that date; 5 cards appear, each with an image of stirrups and a short caption.
- Re-open the popover → it resets to step 1 (calendar). No leaked state.
- Existing **Add Card** popover and all other buttons unchanged.
