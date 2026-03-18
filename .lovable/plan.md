

## Plan: Add Anti-Event Rule to Image Generation Prompt

### Problem
When users generate images from Recipe (time slots), the AI text prompt on line 105 already forbids event/holiday references in **captions and slogans**. However, the **image generation prompt** (lines 874-888) does NOT include this restriction. The image model can still produce visuals with holiday themes (e.g., Nowruz decorations, Christmas trees) even though the text is clean.

### Changes

**File: `supabase/functions/ai-agent/index.ts`**

Add an explicit anti-event/anti-holiday rule to the image prompt (around line 876), right after the "ABSOLUTELY NO DUPLICATES" line:

```
STRICTLY FORBIDDEN IN IMAGE: Do NOT depict any holidays, cultural events, celebrations, seasonal decorations, or festive elements (e.g., Nowruz Haft-sin, Christmas trees, fireworks, flowers for occasions). The image must be a PURE industrial/construction product advertisement with NO event or occasion theme whatsoever.
```

This ensures both the text generation AND the image generation pipelines reject event-themed content when generating from Recipe time slots.

### Files Modified
- `supabase/functions/ai-agent/index.ts` — one insertion in image prompt block

