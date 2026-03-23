

## Fix: Transcription Stops & Translation Errors — Stability Overhaul

### Root Causes Found

1. **WebSocket drops silently (code 1006)**: ElevenLabs Scribe connection drops after ~1min (token expiry or network hiccup). Console shows `WebSocket closed unexpectedly: 1006`. No auto-reconnect exists — transcription just stops and the user sees "Listening... speak now" forever.

2. **Edge function not redeployed**: The deployed `translate-message` still runs OLD code with expensive retry logic. Logs show `"Retry: empty translation for valid input, retrying with simpler prompt"` and `"Retry also failed"` — this doubles latency and causes cascading failures. The current code in the repo has no retry, but it was never deployed.

3. **Duplicate translation calls**: The sidebar's `useEffect` (lines 216-268 in TranscribeView) calls `translate-message` AGAIN for every committed transcript via `supabase.functions.invoke`, even though the hook already translates each segment and stores `farsiText`/`englishText`. This doubles API calls and hits rate limits (60/min).

4. **Empty AI responses cause entry removal**: When translation returns empty (lines 77-81 in hook), the entry is silently removed from the list — the user sees text appear then vanish, making it look broken.

### Changes

**File: `src/hooks/useRealtimeTranscribe.ts` — Auto-reconnect + resilient fallback**

1. Add auto-reconnect on WebSocket drop: detect `isConnected` going false while the user hasn't explicitly disconnected. Use a `shouldBeConnected` ref to distinguish user-initiated disconnect from unexpected drops. On drop, automatically request a new token and reconnect (max 3 retries with 2s backoff).

2. On translation failure or empty result: NEVER remove entries. Always show the original raw text as fallback with `englishText = text` and `farsiText = text`. This ensures the transcript never vanishes.

3. Add a translation queue with concurrency limit (max 3 simultaneous calls) to prevent rate limit hits when speech is fast.

**File: `src/components/office/TranscribeView.tsx` — Remove duplicate sidebar translation**

4. Remove the entire `useEffect` at lines 216-268 that calls `translate-message` for the sidebar. Instead, the sidebar should read directly from `t.farsiText` (or `t.englishText`) already populated by the hook. This eliminates duplicate API calls entirely.

5. Remove `translationMap`, `translatingIds`, and `translatedForLangRef` state variables — they're no longer needed.

6. Update the sidebar display (lines 1133-1149) to use the hook's `farsiText`/`englishText` directly based on `translationLang`, with a "translating..." indicator tied to `t.isTranslating`.

**File: `supabase/functions/translate-message/index.ts` — Redeploy**

7. Force redeployment of the current code (already correct — uses `gemini-2.5-flash`, no retry). This eliminates the "Retry also failed" errors.

### Technical Details

Auto-reconnect pattern:
```text
User clicks Start → shouldBeConnected = true
  WebSocket drops (1006) → if shouldBeConnected:
    wait 2s → get new token → reconnect
    retry up to 3 times with 2s, 4s, 6s backoff
    after 3 failures → show toast, set shouldBeConnected = false
User clicks Stop → shouldBeConnected = false (no reconnect)
```

Sidebar simplification:
```text
Before: hook translates → stores in committedTranscripts
         ALSO sidebar effect → calls translate-message AGAIN → stores in translationMap
         Result: 2x API calls, rate limits, confusion

After:  hook translates → stores englishText/farsiText in committedTranscripts
        sidebar reads directly from committedTranscripts[].farsiText
        Result: 1x API call, no duplication
```

### Files
- `src/hooks/useRealtimeTranscribe.ts` — auto-reconnect, never remove entries, concurrency limit
- `src/components/office/TranscribeView.tsx` — remove duplicate translation effect, simplify sidebar
- `supabase/functions/translate-message/index.ts` — redeploy (no code change needed)

