
Fix the Ad Director AI failure path so exhausted AI credits never crash the page or leave a blank screen.

## Root cause
Two issues need to be handled together:

1. The edge function currently reports `"AI credits exhausted."`, but the user-facing error can still surface as a generic 500 depending on where the status is lost.
2. The Ad Director pipeline treats startup failures as fatal enough to bubble upward from `BackgroundAdDirectorService`, which is risky for async flows and can result in a runtime crash / blank screen instead of a controlled UI recovery.

## Implementation plan

### 1) Normalize AI gateway business errors at the backend
Update `supabase/functions/ad-director-ai/index.ts` so all Lovable AI gateway failures preserve the real HTTP status on every throw path, especially:
- 402 for exhausted credits
- 429 for rate limits
- 401/403 if auth-related
- 500 only for true server faults

This ensures the shared request handler can return the correct status instead of a generic 500.

### 2) Harden the shared error contract
Review `supabase/functions/_shared/requestHandler.ts` and keep the current status inference, but make it deterministic for this function:
- preserve explicit `err.status` whenever present
- keep the JSON shape stable as `{ ok: false, error }`
- never downgrade known payment/rate-limit cases to 500

### 3) Stop the pipeline from crashing the screen on expected business failures
Update `src/lib/backgroundAdDirectorService.ts` so `startPipeline()` does not rethrow known recoverable business errors after resetting state.
Instead:
- return the app safely to `flowState: "idle"`
- clear loading text/progress
- expose a normalized error result or call a controlled notifier path
- only reserve hard rethrowing for truly unexpected developer/runtime faults if needed

This is the main fix for the blank-screen symptom.

### 4) Add one shared frontend error classifier
Create a small shared helper for edge-function failures used by Ad Director UI:
- map 402 → “AI credits exhausted”
- map 429 → “Rate limit reached”
- map 401/403 → auth/access message
- fall back to the server message for unknown errors

Use it consistently so all entry points show the same message.

### 5) Apply the shared classifier to all Ad Director AI entry points
Update these callers to use the same normalized handling:
- `src/components/ad-director/AdDirectorContent.tsx`
- `src/components/ad-director/ChatPromptBar.tsx`
- `src/components/ad-director/ScriptInput.tsx`
- `src/components/ad-director/CharacterPromptDialog.tsx`

Behavior:
- show a destructive toast for 402/429
- keep the editor usable
- close spinners/dialog loading states cleanly
- never leave the app stuck in analyzing mode

### 6) Keep the fallback UI resilient
Optionally refine `src/components/ad-director/AdDirectorErrorBoundary.tsx` messaging so if an unexpected render error still happens, the user sees a safe recovery screen rather than a broken surface.
This is a secondary safety net, not the primary fix.

## Files to change
- `supabase/functions/ad-director-ai/index.ts`
- `supabase/functions/_shared/requestHandler.ts`
- `src/lib/backgroundAdDirectorService.ts`
- `src/components/ad-director/AdDirectorContent.tsx`
- `src/components/ad-director/ChatPromptBar.tsx`
- `src/components/ad-director/ScriptInput.tsx`
- `src/components/ad-director/CharacterPromptDialog.tsx`
- optionally a new shared helper such as `src/lib/edgeFunctionError.ts`

## Validation
After implementation, verify these cases:
1. Trigger `write-script` with exhausted credits → toast appears, no blank screen
2. Trigger full pipeline analysis with exhausted credits → app returns to idle safely
3. Trigger a rate-limit response → friendly message, no crash
4. Unknown server error → graceful failure message, no stuck loading state
5. Ad Director remains interactive after each failure path

## Expected result
- No Ad Director flow crashes when AI credits are exhausted
- Known AI billing/rate-limit errors surface as clear user messages
- The page never goes blank for this class of failure
- Loading overlays/spinners always unwind cleanly
