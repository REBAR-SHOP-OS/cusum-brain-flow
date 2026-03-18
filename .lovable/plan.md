

## Fix: Pixel Agent Should Generate Without Extra Text

### Problem
From the screenshot, when user says "یک عکس بساز" (make a photo), the Pixel agent:
1. Outputs verbose Persian text describing what it's going to create before/instead of generating
2. The user wants: immediate image generation with caption below — no extra chatter

The backend already forces `toolChoice: "required"` for creation keywords, and the `PixelPostCard` already displays captions below images. The issue is in the system prompt — the agent still outputs verbose explanatory text alongside the tool call.

### Root Cause
The agent prompt in `marketing.ts` says "After the image is generated, display it and write the output" — but doesn't explicitly say "NO explanatory text before or after the tool call". The agent interprets this as permission to write Persian descriptions of the creative direction.

### Fix

**File: `supabase/functions/_shared/agents/marketing.ts`**

Add explicit instructions to the social agent prompt:

1. In the "SHORT CREATION COMMAND" section (lines 20-27), add:
   - "Do NOT describe what you are about to create. Do NOT narrate the creative direction. Just call `generate_image` silently."
   - "Your ONLY text output should be the caption and Persian translation AFTER the image URL — nothing before it."

2. In the "CRITICAL BEHAVIOR" section (lines 114-126), add:
   - "NEVER write explanatory text describing the image you are about to generate. No creative direction narration."
   - "When the user says 'بساز' or any short creation command, your response must contain ONLY: the image markdown, caption, contact info, hashtags, and Persian translation. ZERO extra text."

3. In the "MANDATORY OUTPUT FORMAT" section (lines 102-112), reinforce:
   - "This is the COMPLETE response. Do NOT add any text before item 1 (the image). No introduction, no description of what was created, no creative process explanation."

### Files to Change
- `supabase/functions/_shared/agents/marketing.ts` — tighten prompt to eliminate verbose pre-generation text

