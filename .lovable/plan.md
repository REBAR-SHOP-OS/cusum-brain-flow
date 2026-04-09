

# Fix: Image Edit Rate Limit — Increase Retry Budget

## Problem
The image edit feature in `generate-image` edge function has a retry loop (3 attempts) for AI gateway 429 responses, with short delays (2s, 4s). When the Lovable AI gateway is rate-limiting (common with image generation models which are expensive), all 3 attempts fail and the user sees "Rate limit exceeded — retries exhausted."

## Root Cause
- Line 225-246 in `supabase/functions/generate-image/index.ts`: Only 3 attempts with 2s/4s waits
- Image generation models have stricter rate limits on the AI gateway
- The client (`ImageEditDialog.tsx` line 151) also only does 1 retry — so total budget is very thin

## Fix

### File: `supabase/functions/generate-image/index.ts`

1. Increase retry attempts from 3 to 5
2. Use longer exponential backoff: 3s, 6s, 12s, 20s (instead of 2s, 4s)
3. This gives the gateway ~41 seconds total window to free up capacity

Change the retry loop (lines 223-246):
```
// Current:  3 attempts, wait = (attempt+1)*2000
// New:      5 attempts, wait = min(3000 * 2^attempt, 20000)
```

### File: `src/components/social/ImageEditDialog.tsx`

4. Increase client timeout from 90s to 120s to accommodate longer server-side retries
5. Add a more descriptive loading message when waiting

### Result
- Up to 5 server-side retries with proper backoff before giving up
- Client timeout extended to cover the retry window
- If still failing after 5 attempts, the error message stays the same (user should wait and retry)

### Single edge function change + 1 client timeout tweak. No database changes.

