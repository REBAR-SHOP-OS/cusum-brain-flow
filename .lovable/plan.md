

# Fix: Pixel Should Directly Generate Images When Asked

## Problem
The deterministic guardrail at line 573-601 in `ai-agent/index.ts` treats **all new chats** (`history.length === 0`) as schedule requests and returns "Which slot? (Enter 1-5 or "all")" — even when the user explicitly says "یک عکس نوروز بساز" (make a Nowruz image). The user's creative intent is being overridden by the schedule table.

## Solution
Add an **intent detection check** before the schedule guardrail. If the user's message contains image/content creation keywords (in Persian or English), skip the schedule and let the LLM + tool-calling flow handle it — which already has instructions to immediately call `generate_image`.

### `supabase/functions/ai-agent/index.ts` — Line ~575

Add a creation-intent pattern that excludes messages like "بساز", "عکس بساز", "create", "generate", "make an image", etc. from the schedule guardrail:

```ts
// Detect if user wants to CREATE something (not see the schedule)
const isCreationIntent = /\b(بساز|بنویس|درست کن|create|generate|make|build|design|عکس|تصویر|image|photo|video|ویدیو|پست)\b/i.test(msgLower);

const isScheduleRequest = (
  (history.length === 0 && !isCreationIntent) || // new chat WITHOUT creation intent
  /\b(content\s*schedule|schedule\s*for\s*today|today|program|برنامه)\b/i.test(msgLower)
) && !/^\d$/.test(msgLower) && msgLower !== "all";
```

This way:
- "یک عکس نوروز بساز" → `isCreationIntent = true` → skips schedule → goes to LLM which calls `generate_image`
- Opening a new chat with no specific request → still shows the schedule
- "برنامه امروز" → still shows the schedule

### Files
- **Edit**: `supabase/functions/ai-agent/index.ts` (lines 573-578)

