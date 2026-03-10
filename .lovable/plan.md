

# Speed Up Extraction Pipeline

## Problem
The extraction process blocks the UI for 2+ minutes because everything runs synchronously: the client calls `extract-manifest`, waits for the AI response, saves rows, then runs dedupe — all in one blocking chain. The edge function itself can take 60-120s just for the AI call.

## Solution: Async Extraction with Background Processing

Convert the synchronous `runExtract()` call into an async fire-and-forget pattern. The edge function does the heavy work in the background while the client polls the database for status updates.

## Changes

### 1. Update `extract-manifest` Edge Function
**File: `supabase/functions/extract-manifest/index.ts`**

- Accept `sessionId` in the request body
- Use `EdgeRuntime.waitUntil()` to run AI extraction in the background
- Return immediately with `{ status: "processing", sessionId }`
- Inside the background task:
  - Update `extract_sessions.status = 'extracting'` with a `progress` field (0→50→100)
  - Call AI, parse response, insert `extract_rows`
  - Update session to `status = 'extracted'` on success, or `status = 'error'` with error message on failure
- Reduce `maxTokens` from 32000 → 16000 for spreadsheets (most schedules fit in 8-12K tokens)

### 2. Update `extractService.ts` — Make `runExtract` Non-Blocking
**File: `src/lib/extractService.ts`**

- Change `runExtract()` to just invoke the edge function and return immediately (no awaiting AI result)
- Remove the row-saving logic from the client side (edge function now handles it)

### 3. Update `AIExtractView.tsx` — Poll for Completion
**File: `src/components/office/AIExtractView.tsx`**

- After calling `runExtract()`, enter a polling loop that checks `extract_sessions` status every 3 seconds
- Show a progress indicator with the step name from the session record
- When status changes to `extracted`, proceed with dedupe as before
- When status changes to `error`, show the error and stop
- Use the existing realtime subscription on `extract_sessions` instead of polling (already set up in `useExtractSessions`)

### 4. Add `progress` Column to `extract_sessions`
**Database migration:**
```sql
ALTER TABLE public.extract_sessions 
ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message text;
```

## Flow Comparison

```text
BEFORE (synchronous, blocks 2+ min):
  Client → edge fn (waits for AI 60-120s) → save rows → return → dedupe

AFTER (async, returns in <1s):
  Client → edge fn (returns immediately) → background: AI + save rows + update status
  Client polls session status → sees "extracted" → proceeds to dedupe
```

## Summary
- 1 database migration (add `progress` + `error_message` columns)
- 1 edge function rewrite (`extract-manifest` — async with `EdgeRuntime.waitUntil`)
- 2 client files updated (`extractService.ts`, `AIExtractView.tsx`)
- Result: UI returns to interactive in <1 second; extraction runs in background with live status updates

