

# Fix Vizzy Voice Connection Timeout — Root Cause & Solution

## Root Cause (confirmed from logs)

OpenAI returns **400 Bad Request**: `Unknown parameter: 'turn_detection.eagerness'`. The model `gpt-4o-mini-realtime-preview-2025-06-03` does not support the `eagerness` parameter in `turn_detection`. Every connection attempt fails immediately, causing the timeout and auto-retry loop seen in the screenshot.

This needs fixing in **two places** — the edge function and the client hook.

## Changes

| File | Change |
|------|--------|
| `supabase/functions/voice-engine-token/index.ts` | Remove `eagerness` from destructuring (line 17) and remove the conditional block that adds it to `turnDetection` (lines 26-28). Also update default model from `gpt-4o-realtime-preview-2024-12-17` to `gpt-4o-mini-realtime-preview-2025-06-03` to match what the client actually sends. |
| `src/hooks/useVoiceEngine.ts` | Remove `eagerness` from the config interface (line 42), remove `eagerness` from the body sent to `voice-engine-token` (line 465). |
| `src/hooks/useVizzyVoiceEngine.ts` | Remove `eagerness: "low"` from the config passed to `useVoiceEngine` (line 273). |

## Vizzy Brain Integration

The voice engine already uses Vizzy Brain data — the `useVizzyVoiceEngine` hook fetches `vizzy-pre-digest` (which contains all Brain data including memories) and injects it into the system instructions. The `appendLiveResult` mechanism feeds real-time tool results back into the session. No changes needed for this — it's already working correctly once the connection succeeds.

## Deploy

After code changes, deploy `voice-engine-token` edge function immediately.

