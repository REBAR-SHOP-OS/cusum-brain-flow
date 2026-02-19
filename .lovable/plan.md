
# Render Screenshot URLs as Inline Images in Task Descriptions

## Problem
In the task detail drawer, screenshot URLs in the description (e.g., `Screenshot: https://...clearance-photos/...1234.png`) are displayed as raw clickable links instead of inline images. Users want to see the actual screenshot preview directly.

## Solution
Modify the `linkifyText` function in `src/pages/Tasks.tsx` to detect image URLs (ending in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) and render them as clickable `<img>` elements instead of text links.

## Technical Details

**File:** `src/pages/Tasks.tsx`  
**Function:** `linkifyText` (lines 136-145)

**Current behavior:** All URLs are rendered as `<a>` links with the full URL as text.

**New behavior:** URLs ending in common image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) will be rendered as:
- A clickable `<img>` tag showing the image preview
- Wrapped in an `<a>` tag so clicking opens the full image in a new tab
- Styled with rounded corners, max-width constraint, and a small margin

All other URLs remain as text links (no change).

**Change scope:**
- Only the `linkifyText` function (lines 136-145) in `src/pages/Tasks.tsx`
- No other files, components, or logic affected
