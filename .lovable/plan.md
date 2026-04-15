
## Plan: Make Persian caption translation always follow the current caption text

### Do I know what the issue is?
Yes.

### Root cause
There are 2 separate bugs causing the same symptom:

1. **`PixelPostCard.tsx` only keeps the translation in local state**
   - The card auto-translates locally, but when you approve/save the card it sends the **original `post` object** upward.
   - That means `captionTranslation` / `imageTextTranslation` are often still empty when the post is saved.
   - Result: newly created cards are saved without the Persian block, so later the review panel has nothing to show.

2. **The translation logic is not strictly tied to the latest caption text**
   - In both `PixelPostCard.tsx` and `PostReviewPanel.tsx`, translation is gated by “do we already have any translation?”
   - So after a caption changes/regenerates, the UI can keep stale/empty translation instead of regenerating from the new caption.
   - This conflicts with your rule: **always use the caption text as the source of truth**.

### Files to update

#### 1) `src/components/social/PixelPostCard.tsx`
Make the card translation logic caption-driven and persistent:
- Reset local translation state when `post.id`, `post.caption`, or incoming translation props change
- Auto-translate based on **`post.caption` only** for caption translation
- Do **not** require image text to exist before showing caption translation
- When user approves the card, pass the enriched post back:
  - `captionTranslation: localCaptionTranslation`
  - `imageTextTranslation: localImageTextTranslation`
  - `imageUrl: currentImageUrl`

This ensures new cards carry their Persian translation into the saved post.

#### 2) `src/pages/AgentWorkspace.tsx`
Fix the approval/save path:
- In `handleApprovePost`, save the translation values coming from the approved card payload
- Always append `---PERSIAN---` using the approved card’s latest translations, not only the original parsed values
- This guarantees newly created cards are stored with Persian translation immediately

#### 3) `src/components/social/PostReviewPanel.tsx`
Make the review panel always follow the current caption:
- Treat **`localContent` (caption field)** as the translation source of truth
- If the current caption changes, clear stale caption translation and regenerate it from the new caption
- Debounce translation requests so it doesn’t fire on every keystroke
- Update the local Persian UI immediately after translation returns
- Persist the refreshed Persian block back to the post content

Also:
- keep image-text translation optional
- always show caption translation even if image text is empty

### Behavior after fix
- A newly generated card will show Persian caption translation
- If that card is approved, the saved post will keep the same Persian translation
- If the caption is edited or regenerated later, the Persian translation will refresh from the **new caption text**
- The “Caption translation” section will no longer stay empty just because image text is missing

### No backend/schema changes
- No database migration needed
- `translate-caption` can stay as-is unless I find a formatting edge case while implementing

### Validation
After implementation I will verify these exact flows:
1. Generate a new card → confirm Persian caption appears on the card
2. Approve that card → open review panel → confirm Persian caption is still there
3. Regenerate caption → confirm Persian caption updates to match the new English caption
4. Manually edit caption → confirm Persian caption refreshes from the edited text
5. Confirm image-text can be empty while caption translation still shows correctly
