

## Fix: Agent Still Outputs Verbose Persian Text After Image

### Problem
From the screenshot, the post-processing safety net works for text BEFORE the image, but the agent is writing verbose Persian descriptions AFTER the image markdown (circled in red). The structured format (English caption → contact → hashtags → ---PERSIAN--- block) is not being followed.

### Root Cause
The follow-up AI call (line 1094) receives the tool results but still generates verbose Persian text instead of the structured output. The current post-processing only strips pre-image text (`reply.indexOf("![")`), not post-image Persian narration.

### Fix

**File: `supabase/functions/ai-agent/index.ts`** (post-processing, lines 1146-1157)

Expand the social agent post-processing to also clean post-image content:
1. Keep existing pre-image stripping
2. Add: After the image markdown, detect Persian/Arabic script blocks that appear BEFORE `---PERSIAN---` and remove them
3. If the reply contains an image URL but the text after it is mostly Persian (no English caption structure), replace the post-image text with just the `---PERSIAN---` block if it exists, or strip the Persian text entirely

```
// Regex to detect Persian/Arabic script characters
const persianRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// After image markdown, find text before ---PERSIAN---
// If that text contains Persian characters, it's narration — strip it
```

**File: `supabase/functions/_shared/agents/marketing.ts`** (prompt, around line 103-117)

Add an even more forceful instruction specifically for the follow-up call context:
- Add to MANDATORY OUTPUT FORMAT: "When you receive a tool result containing `image_url`, you are in POST-TOOL mode. In POST-TOOL mode, your response is EXACTLY: `![Product](URL)` then English caption then contact info then hashtags then `---PERSIAN---` block. You must NOT describe the image in Persian or any language. The caption must be a short English promotional sentence."
- Add: "POST-TOOL RESPONSE TEMPLATE — copy this structure exactly, filling in values:\n```\n![Product Name](IMAGE_URL)\nYour English promotional caption here.\n📍 9 Cedar Ave, Thornhill, Ontario\n📞 647-260-9403\n🌐 www.rebar.shop\n#hashtag1 #hashtag2\n---PERSIAN---\n📝 ترجمه کپشن: Persian translation of caption\n```"

**File: `supabase/functions/ai-agent/index.ts`** (follow-up call, around line 1091)

Before the follow-up AI call, inject a reminder system message specifically for the social agent:
```typescript
if (agent === "social") {
  nextMessages.push({
    role: "user",
    content: "SYSTEM REMINDER: Output ONLY the markdown image, English caption, contact info, hashtags, and ---PERSIAN--- translation. No Persian text outside ---PERSIAN--- block. No descriptions. No narration."
  });
}
```

### Files to Change
- `supabase/functions/_shared/agents/marketing.ts` — add explicit response template
- `supabase/functions/ai-agent/index.ts` — add follow-up call reminder + expand post-processing to strip post-image Persian narration

