

# Fix: Persian Translation Not Persisted to Database

## Problem
The "🔒 Internal reference only" section always shows "ترجمه‌ای موجود نیست" in the Social Media Manager review panel, even when the AI agent generated Persian translations.

## Root Cause
Data flow breakdown:

1. AI agent generates content with `---PERSIAN---` block in the message
2. `PixelChatRenderer.extractPostData()` **parses** the Persian block into separate fields: `imageTextTranslation` and `captionTranslation`
3. These fields are stripped from `caption` — so `post.caption` no longer contains `---PERSIAN---`
4. `handleApprovePost` in `AgentWorkspace.tsx` looks for `---PERSIAN---` inside `post.caption` → finds nothing → saves empty Persian block to DB
5. `PostReviewPanel` reads from DB content → no Persian block → shows fallback "ترجمه‌ای موجود نیست"

## Solution

### File: `src/pages/AgentWorkspace.tsx`

In `handleApprovePost`, instead of only extracting Persian from `post.caption`, also reconstruct it from the `PixelPostData` fields `imageTextTranslation` and `captionTranslation`:

```typescript
// Current: only checks post.caption for ---PERSIAN---
const persianIdx = rawCaption.indexOf("---PERSIAN---");
const persianBlock = persianIdx !== -1 ? rawCaption.slice(persianIdx) : "";

// Fixed: also reconstruct from PixelPostData fields
let persianBlock = "";
const persianIdx = rawCaption.indexOf("---PERSIAN---");
if (persianIdx !== -1) {
  persianBlock = rawCaption.slice(persianIdx);
} else if (post.imageTextTranslation || post.captionTranslation) {
  persianBlock = "---PERSIAN---\n🖼️ متن روی عکس: " 
    + (post.imageTextTranslation || "") 
    + "\n📝 ترجمه کپشن: " 
    + (post.captionTranslation || "");
}
```

This ensures Persian translations flow from AI → chat card → DB → review panel.

## Files Changed
- `src/pages/AgentWorkspace.tsx` — reconstruct Persian block from `post.imageTextTranslation` and `post.captionTranslation` when `---PERSIAN---` is not found in caption

