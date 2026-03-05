

# Restructure PixelPostCard Layout

## Current Problem
The card currently shows: Image → Caption (mixed with everything) → Hashtags → Persian box. Contact info is stripped out entirely. Persian translation is shown as one block.

## Desired Layout (per user request)
1. **Image**
2. **Caption** (promotional text only, no address/hashtags)
3. **Company Address** (📍 📞 🌐 lines)
4. **Hashtags**
5. **Internal Reference Box** (separate styled box):
   - Translation of the text on the image (🖼️ متن روی عکس)
   - Translation of the caption (📝 ترجمه کپشن)
   - Labeled as "for your reference only — not published"
6. **Action buttons** (Approve / Regenerate)

## Changes

### 1. `PixelPostData` interface — add `contactInfo` and split Persian fields
Add `contactInfo` field and split `persianTranslation` into `imageTextTranslation` and `captionTranslation`.

### 2. `PixelChatRenderer.tsx` — extract contact info separately
Instead of stripping contact info lines, capture them into a `contactInfo` string. Parse the `---PERSIAN---` section into two parts: image text (🖼️) and caption translation (📝).

### 3. `PixelPostCard.tsx` — restructure the card layout
Reorder sections:
- Image
- Caption text
- Contact info block (📍 📞 🌐)
- Hashtags
- Internal reference box with image text translation + caption translation
- Approve/Regenerate buttons at the bottom

## Files to Edit
1. `src/components/social/PixelPostCard.tsx` — Update interface + layout
2. `src/components/social/PixelChatRenderer.tsx` — Extract contact info + split Persian translations

