

# Auto-Generate on Time Input — Skip Clarification Questions

## Problem
When the user types a time like "6:30" or "06:30" in the Pixel agent chat, the system doesn't recognize it as a slot trigger. It falls through to the LLM, which asks a clarification question instead of immediately generating the image for that slot.

## Solution
Add a time-to-slot mapping regex in the deterministic guardrail section of `ai-agent/index.ts` so that typing a time (e.g. "6:30", "06:30", "7:30", "12:30", "14:00") immediately triggers image generation for the corresponding slot — no LLM involvement, no questions asked.

## Changes

### `supabase/functions/ai-agent/index.ts`
In the deterministic guardrail block (line ~650), add a time-matching regex after existing pattern checks:

```typescript
// Map time strings to slot numbers
const TIME_TO_SLOT: Record<string, number> = {
  "06:30": 1, "6:30": 1,
  "07:30": 2, "7:30": 2,
  "08:00": 3, "8:00": 3,
  "12:30": 4,
  "14:00": 5,
};
const timeMatch = TIME_TO_SLOT[msgLower.trim()];
```

Then include `timeMatch` in the condition:
```typescript
if (slotMatch || isAllSlots || timeSlotNum || isRegenerate || timeMatch) {
```

And use it when resolving the slot number:
```typescript
const resolvedSlotNum = isRegenerate
  ? parseInt(regenMatch![1])
  : (timeSlotNum || timeMatch || parseInt(slotMatch?.[1] || "1"));
```

This is a single-file, ~10-line change. No UI changes needed.

