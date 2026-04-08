

# Fix Vizzy Voice — Context Loading Timeout + Connection Failures

## Root Cause Analysis

Two separate issues are causing the failures shown in the screenshots:

### Issue 1: "context loading failed"
The `vizzy-pre-digest` edge function takes 60–92 seconds to complete (confirmed in logs), but the client timeout is only **45 seconds**. It always times out. The fallback to `vizzy-daily-brief` has only a **25-second** timeout and also fails. Result: Vizzy starts without business data.

### Issue 2: "Could not connect"
The `voice-engine-token` edge function does not retry on OpenAI 503 errors (confirmed in logs: "upstream connect error or disconnect/reset before headers"). A single transient failure kills the entire session. Additionally, the `eagerness` parameter sent by the client is silently dropped — it is never forwarded to OpenAI's session creation API.

## Changes

### 1. `src/hooks/useVizzyVoiceEngine.ts` — Increase context loading timeouts

| Parameter | Current | New |
|-----------|---------|-----|
| `vizzy-pre-digest` timeout | 45s | 120s |
| `vizzy-daily-brief` fallback timeout | 25s | 60s |

These match the actual observed execution times (60–92s).

### 2. `supabase/functions/voice-engine-token/index.ts` — Add retry + forward `eagerness`

- Accept `eagerness` from request body
- Include `eagerness` in the `turn_detection` object sent to OpenAI
- Add a 2-attempt retry loop with 2s backoff for OpenAI 503/504 errors
- This prevents a single transient OpenAI outage from killing the connection

### 3. `src/hooks/useVoiceEngine.ts` — Increase connection timeout default

Change the default `connectionTimeoutMs` from 15s to 25s to give more room for retries in the token function.

## Summary

| File | Change |
|------|--------|
| `useVizzyVoiceEngine.ts` | Increase pre-digest timeout to 120s, daily-brief fallback to 60s |
| `voice-engine-token/index.ts` | Add retry on 503/504, forward `eagerness` parameter |
| `useVoiceEngine.ts` | Increase default connection timeout to 25s |

No database changes. Edge function redeployment required for `voice-engine-token`.

