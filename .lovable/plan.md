

## Plan: Deduplicate Hashtags in Caption + Always Show Translations

### Problem
1. **Duplicate hashtags**: The caption text sometimes contains hashtags that also appear in the separate hashtags field below, causing visual redundancy (as shown in screenshot).
2. **Missing translations**: The internal reference box (image text + caption translation) only renders when data exists — but the AI agent should always produce translations, and the card should always show the section (even if empty, as a placeholder).

### Changes

#### 1. `src/components/social/PixelChatRenderer.tsx` — Strip hashtags from caption text

In `extractPostData()`, after extracting hashtags on line 104-105, the caption cleanup on line 122 already removes pure-hashtag lines. But hashtags embedded within the caption text (mixed with regular words) survive. 

**Fix**: After building `textContent`, strip ALL `#Word` tokens from the caption since they're already captured in the `allHashtags` field:

```typescript
// After line 123, add:
textContent = textContent.replace(/#[a-zA-Z]\w*/g, "").replace(/\s{2,}/g, " ").trim();
```

#### 2. `src/components/social/PixelPostCard.tsx` — Always show internal reference box

Currently the box only renders when `post.imageTextTranslation || post.captionTranslation` is truthy. Change it to always render, showing a "No translation available" placeholder when empty. This ensures the user always sees the section exists.

**Fix**: Remove the `hasInternalRef` conditional gate. Always render the internal reference box. When translations are empty, show placeholder text.

#### 3. `src/components/social/PixelPostCard.tsx` — Deduplicate hashtags from caption display

As a safety net, also strip any `#Word` tokens from `post.caption` before rendering, in case data comes from sources other than `PixelChatRenderer`.

### Files Changed
- `src/components/social/PixelChatRenderer.tsx` — Strip hashtag tokens from caption text
- `src/components/social/PixelPostCard.tsx` — Always show translation box + deduplicate hashtags from displayed caption

