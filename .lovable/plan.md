

## Plan: Apply Patch A — Safe Production Behavior for PersonaPlex Voice

### Assessment

After reviewing the full codebase, the existing implementation already follows ~90% of Patch A's rules. Here's what's already in place and what needs to be added:

**Already working correctly:**
- Vizzy One API is the single backend source of truth (via `personaplex-voice` edge function proxy)
- If API returns `audio_base64`, it plays it
- If API returns `audio_base64: null`, text is rendered immediately, browser TTS used as fallback
- Debug badges visible: `apiConnected`, `intent`, `grounded`, `voicePath`, `audioStatus`
- App is read-only — never simulates ERP actions
- Error states show clear text in transcript ("⚠️ Vizzy API is unreachable")
- No fake PersonaPlex audio is generated in Lovable

**Missing (to add):**
1. A "Patch A active" debug badge in the UI header bar
2. An internal note "Native PersonaPlex audio still in lab"
3. When `audioStatus` is browser-fallback, make it visually distinct (currently browser TTS is used silently without a badge update — `audioStatus` stays "text-only" which is correct but doesn't explicitly say "browser-fallback")
4. Console log confirming Patch A is active on session start

### Changes

**`src/hooks/useVizzyStreamVoice.ts`** (2 small changes):
- Add `console.log("[Patch A] active — native PersonaPlex audio still in lab")` in `startSession`
- When browser TTS fallback fires, set `audioStatus` to `"browser-fallback"` instead of leaving it as `"text-only"` (honest labeling)

**`src/components/vizzy/VizzyVoiceChat.tsx`** (2 small changes):
- Add a small "Patch A" debug badge next to existing badges (green, always visible when connected)
- Update audio status badge to handle `"browser-fallback"` label distinctly (amber with 🔊 BROWSER label)

### Files
| File | Change |
|---|---|
| `src/hooks/useVizzyStreamVoice.ts` | Add Patch A log + honest browser-fallback labeling |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Add "Patch A" badge + browser-fallback badge styling |

### What stays unchanged
- Edge function `personaplex-voice/index.ts` — no changes needed, already correct
- Audio playback logic — already plays base64 when present, falls back to browser TTS
- All debug badges — preserved and enhanced
- Read-only behavior — preserved
- UI polish — preserved

### Result
- "Patch A active" badge visible in debug bar during live sessions
- Honest labeling: browser fallback is clearly shown, not hidden
- Console confirms Patch A status
- Vizzy One API remains the single backend source of truth
- No fake PersonaPlex audio

