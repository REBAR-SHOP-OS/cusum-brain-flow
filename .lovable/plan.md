

# Fix: Image Generation Timeout for Non-Square Ratios

## Root Cause

When Pixel generates images with 9:16 ratio (as shown in screenshot), the pipeline can timeout because:

1. **The 1:1 fallback retry loop (line 827-895) has NO AbortController timeout** — if the AI gateway hangs, it blocks indefinitely
2. **Total pipeline = 3 primary attempts (60s each) + 3 fallback attempts (unlimited) = potentially 360s+**, far exceeding the 120s client timeout in `sendAgentMessage`
3. **The edge function itself gets killed** by Deno's wall-clock limit before the client timeout fires, causing an abort error that shows as "Image generation is taking longer than expected"

## Fix

### 1. Add timeout to fallback retry loop (`agentToolExecutor.ts` ~line 827)
Add the same 60s `AbortController` timeout that the primary loop uses. This is the missing piece.

### 2. Reduce total attempts from 6 to 4
- Primary: 2 attempts (gemini-flash, gemini-pro) instead of 3 (currently gemini-flash is duplicated at lines 700-701)
- Fallback: 2 attempts max
- Total worst case: 4 × 60s = 240s, but with early-exit logic this is typically under 120s

### 3. Increase client-side timeout for social agent (`agent.ts`)
Bump the `sendAgentMessage` timeout from 120s to 180s specifically, or make it configurable per agent. The image pipeline genuinely needs more time.

### 4. Better error message differentiation (`AgentWorkspace.tsx`)
Instead of a generic "Image generation is taking longer", show specific guidance like "Image generation timed out. Try with a simpler prompt or square (1:1) ratio."

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/agentToolExecutor.ts` | Add AbortController to fallback loop; remove duplicate attempt; limit fallback to 2 attempts |
| `src/lib/agent.ts` | Increase timeout from 120s to 180s |
| `src/pages/AgentWorkspace.tsx` | Improve timeout error message |
| Redeploy `ai-agent` | |

