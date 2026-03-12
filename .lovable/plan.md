

# Fix: Analysis Timeout (signal aborted at 90s)

## Root Cause

The network log confirms `signal is aborted without reason` — the 90-second client timeout fires before Gemini 2.5 Pro finishes generating the structured storyboard (16,384 token budget + complex tool schema). The timeline:

1. **Client**: `invokeEdgeFunction` AbortController fires at 90s
2. **Edge function**: each AI attempt has a 50s AbortController — so primary attempt aborts at 50s, fallback starts but the **client** has already given up at 90s total
3. The `withTimeout()` wrapper is redundant (also 90s) but harmless

Two problems:
- **50s per-attempt** is too short for Gemini Pro with 16K tokens on a complex structured tool call
- **90s client timeout** doesn't leave room for primary (50s) + fallback (50s) = 100s minimum

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts` — Increase per-attempt timeout for heavy routes

Change `PER_ATTEMPT_TIMEOUT_MS` from a flat 50s to route-aware:
- Heavy routes (`analyze-script`, `generate-storyboard`): **80s** per attempt
- All other routes: keep 50s

This gives Gemini Pro enough time to complete the structured storyboard without aborting.

### 2. `src/components/ad-director/AdDirectorContent.tsx` — Increase client timeout for analyze step

- Change `EDGE_TIMEOUT_MS` from 90s to **180s** (only used for ad-director calls)
- This accommodates primary attempt (80s) + fallback attempt (80s) = 160s worst case
- Remove the redundant `withTimeout()` wrapper — `invokeEdgeFunction` already has its own AbortController

### 3. Reduce token budget for analyze-script (optional optimization)

Change `analyze-script` maxTokens from 16,384 to **8,192** — the storyboard output for a 30s ad (6-8 scenes) rarely exceeds 4K tokens. Smaller budget = faster model response.

### Files
- `supabase/functions/ad-director-ai/index.ts` — route-aware per-attempt timeout, reduce analyze token budget
- `src/components/ad-director/AdDirectorContent.tsx` — increase client timeout to 180s, remove redundant `withTimeout`

