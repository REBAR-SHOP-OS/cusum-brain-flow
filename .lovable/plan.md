

# Fix: Image Generation Silently Fails — Permanent Solution

## Problem Identified

After extensive investigation, the `aspect_ratio` parameter has already been removed from the API request body in previous fixes. However, image generation **still fails** for two interconnected reasons:

### Root Cause 1: Prompt Instructions Still Reference `aspect_ratio` Parameter
The marketing agent prompt (`supabase/functions/_shared/agents/marketing.ts`) and the social style override block (`supabase/functions/ai-agent/index.ts`) both instruct the AI to "Pass the `aspect_ratio` parameter" when calling `generate_image`. The AI model faithfully reports errors about this parameter to the user in Persian, even though the backend now handles ratios correctly without it.

**Evidence from logs:**
- The AI calls `generate_image` with `args.aspect_ratio = "9:16"` or `"1:1"` — this is harmless since the executor reads it from `context.imageAspectRatio` anyway.
- But the AI's TEXT reply after the tool loop is EMPTY, triggering the recovery path which generates a generic apology mentioning "aspect ratio".

### Root Cause 2: Image Generation Silently Fails (No Logs After Tool Call)
The edge function logs show `[generate_image] aspectRatio resolved: ...` but NO subsequent success (`✓`) or failure (`✗`) logs. This means the Lovable AI gateway image call is timing out or failing without proper error capture. The `console.warn` inside the retry loop never fires, suggesting the `fetch` call itself hangs until the edge function shuts down.

### Root Cause 3: Marketing Prompt Tells AI to Apologize About Aspect Ratio
Line 55 of `marketing.ts`: "If image generation fails with one aspect ratio, automatically retry with 1:1 (square) as fallback. NEVER tell the user there's a problem with a specific ratio — just produce the image."

Despite this instruction, the AI still mentions aspect ratio errors because:
- The prompt on lines 18 and 972-973 (`ai-agent/index.ts`) explicitly say "Pass the `aspect_ratio` parameter" — this conflicting instruction causes the AI to fixate on the parameter.

## Solution: 4 Changes

### 1. Remove `aspect_ratio` from Tool Definition (`agentTools.ts`)
Remove the `aspect_ratio` property from the `generate_image` tool parameters. The backend already reads the ratio from `context.imageAspectRatio` (which comes from the UI). The AI model should NOT be responsible for passing this parameter.

**File:** `supabase/functions/_shared/agentTools.ts` (line 73)
- Delete the `aspect_ratio` property from the `generate_image` function parameters

### 2. Remove `aspect_ratio` Instructions from Marketing Prompt (`marketing.ts`)
Remove all lines instructing the AI to "pass the `aspect_ratio` parameter". The ratio is handled automatically by the system.

**File:** `supabase/functions/_shared/agents/marketing.ts` (lines 18, 55)
- Line 18: Remove "Pass the aspect_ratio parameter matching the user's size selection..."
- Line 55: Remove the instruction about retrying with different ratios

### 3. Remove `aspect_ratio` Instructions from Social Style Override (`ai-agent/index.ts`)
The style override block at lines 972-973 tells the AI to "Pass the `aspect_ratio` parameter". Remove these lines.

**File:** `supabase/functions/ai-agent/index.ts` (lines 972-973)
- Remove the two lines that instruct the AI to pass `aspect_ratio`

### 4. Add Timeout + Better Error Logging to Image Generation (`agentToolExecutor.ts`)
Add a 60-second `AbortController` timeout to the image generation `fetch` call so it doesn't hang indefinitely and add explicit logging when the fetch fails or times out.

**File:** `supabase/functions/_shared/agentToolExecutor.ts` (around line 723)
- Wrap the `fetch` call with a 60-second timeout using `AbortController`
- Add explicit error logging for timeout vs. other failures
- Ensure the retry loop continues to the next model on timeout

## Expected Result
- The AI will no longer mention "aspect ratio" errors to users
- Image generation will either succeed or fail cleanly with proper error messages
- All aspect ratios (16:9, 9:16, 1:1) will work because the system reads the ratio from context and handles it via prompt instructions + server-side cropping
- Timeouts won't silently kill the function — they'll be caught and the next model will be tried

