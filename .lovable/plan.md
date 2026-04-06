

# Fix: voice-engine-token RUNTIME_ERROR — Unknown Parameter `eagerness`

## Root Cause

The edge function logs show the exact error:

```
OpenAI Realtime session error: 400
"Unknown parameter: 'turn_detection.eagerness'."
```

The `eagerness` parameter is being sent to OpenAI's `/v1/realtime/sessions` endpoint, but the model `gpt-4o-realtime-preview-2024-12-17` does not support it. OpenAI returns 400, the function returns `{ error: "Failed to create realtime session" }`, the frontend gets no `client_secret`, and throws — crashing the page.

The repeated "shutdown" logs with no "booted" suggest the function is also hitting a stale deployment state from repeated failures.

## Fix

### 1. Remove `eagerness` from the OpenAI API request body (`supabase/functions/voice-engine-token/index.ts`)

- Remove `eagerness` from destructured body params (line 18)
- Remove `eagerness` from the `turn_detection` object sent to OpenAI (line 38)
- Keep accepting it from the frontend (backward compat) but simply don't forward it

### 2. Redeploy the edge function

Force a fresh deployment to clear the stale shutdown state.

## No other files need changes

The frontend (`useVoiceEngine.ts` line 406) still sends `eagerness` — that's fine, the edge function will just ignore it. No frontend change needed.

## Impact
- Fixes the 400 error from OpenAI, restoring Vizzy voice functionality
- No behavior change for any other feature
- Backward compatible — older clients sending `eagerness` won't break

