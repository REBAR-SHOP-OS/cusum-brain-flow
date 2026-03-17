

# Fix: Pixel Agent Must Generate Images Immediately (No Questions)

## Problem
When the user asks Pixel to create an image (e.g. "یک تصویر بساز برای نوروز"), the agent responds by asking which aspect ratio to use — even though the user has already selected it via the toolbar pill button (9:16, 1:1, 16:9). The agent should immediately call `generate_image` without any follow-up questions.

## Root Cause
The `social` agent has `toolChoice: "auto"`, so Gemini chooses to ask clarifying questions instead of calling tools. The empire agent already has a fix for this (`toolChoice: "required"`), but the social agent doesn't.

Additionally, the system prompt tells the agent not to ask for clarification on short creation commands, but the model ignores this instruction (same pattern as the empire agent issue).

## Fix

### 1. Force `toolChoice: "required"` for Pixel creation requests
**File**: `supabase/functions/ai-agent/index.ts` (~line 1012)

Detect when the `social` agent receives a creation message (keywords: "بساز", "create", "generate", "make", "عکس", "image", "تصویر", "نوروز", "build") and force `toolChoice: "required"` on the first turn — same pattern as the empire fix.

```
Before:  toolChoice forced only for empire agent
After:   toolChoice forced for both empire AND social (creation requests)
```

### 2. Add explicit aspect ratio instruction to the system prompt
**File**: `supabase/functions/_shared/agents/marketing.ts` (~line 13)

Strengthen the short-creation-command rule to explicitly state: "The aspect ratio is ALREADY selected by the user in the toolbar. Use it from context. NEVER ask the user about aspect ratio."

### 3. Add aspect ratio to the style override injection
**File**: `supabase/functions/ai-agent/index.ts` (~line 972)

Add the selected aspect ratio to the `socialStyleOverride` message so the AI knows exactly what dimensions to use, removing any reason to ask.

### 4. Deploy

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Force `toolChoice: "required"` for social agent creation requests; inject aspect ratio into style override |
| `supabase/functions/_shared/agents/marketing.ts` | Strengthen prompt: never ask about aspect ratio, it comes from toolbar |
| Redeploy `ai-agent` | Apply changes |

