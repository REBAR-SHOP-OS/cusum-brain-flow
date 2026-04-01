

# Vizzy Live Session Debug — Root Cause Analysis & Fix Plan

## Findings

### Layer 1: Session Bootstrap — PARTIAL FAILURE
- `voice-engine-token` edge function works correctly (logs show successful token issuance at 23:40:10Z)
- `vizzy-pre-digest` **crashes** with `ReferenceError: user is not defined` at line 59
  - Root cause: Function destructures `{ userId }` from `ctx` (line 20), but references `user.id` in 5 places (lines 59, 185, 190, 201)
  - Should be `userId` everywhere
- Fallback to `vizzy-daily-brief` appears to succeed (no errors in logs)
- Net effect: Context loading works via fallback, session starts. **Not the blocking issue but needs fixing.**

### Layer 2: Realtime Transport — LIKELY ROOT CAUSE
The WebRTC connection establishes successfully (screenshot shows "LIVE SESSION" green dot, "Live ERP Data Connected"). However, no assistant responses appear. Two probable causes:

**A. Audio autoplay policy (HIGH PROBABILITY)**
In `useVoiceEngine.ts` line 300-303, a detached `<audio>` element is created:
```ts
const audioEl = document.createElement("audio");
audioEl.autoplay = true;
pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };
```
This element is never appended to the DOM. Modern browsers (especially mobile) silently refuse autoplay on detached audio elements without prior user gesture. If audio output is blocked, the Realtime API may stall or behave unpredictably (it expects the client to consume audio).

**B. Model availability**
The model `gpt-4o-mini-realtime-preview` is used. If OpenAI has deprecated or rate-limited this model, the session would connect but produce no responses. The data channel would simply never emit `response.audio_transcript.done` events.

### Layer 3: Audio / Mute State
Screenshot shows "Muted" — `isMuted = true`. The user transcript visible was captured before muting. Mute correctly disables mic tracks. This is a UX issue (user may have accidentally muted) but is NOT the root cause since the transcript proves audio was captured.

### Layer 4: Agent Response Pipeline
No server-side handler exists — this is a direct WebRTC connection to OpenAI's Realtime API. The "pipeline" is entirely within OpenAI's infrastructure. If the data channel receives `response.audio_transcript.done`, the text appears. The absence of any agent transcript in the UI means either:
- OpenAI never generated a response (model issue or audio output stall)
- The response was filtered by `isSelfTalk()` — unlikely for substantive responses in non-translation mode

### Layer 5: UI Rendering
UI rendering logic is correct. If `response.audio_transcript.done` events arrive with text, they would display. The filtering in `isSelfTalk` is minimal in non-translation mode (only filters dots, "oh/hmm/uh", and echo detection).

---

## Fix Plan

### Fix 1: `vizzy-pre-digest` crash (5 references to `user.id` → `userId`)
**File:** `supabase/functions/vizzy-pre-digest/index.ts`
- Line 59: `.eq("user_id", user.id)` → `.eq("user_id", userId)`
- Line 185: `.eq("user_id", user.id)` → `.eq("user_id", userId)`
- Line 190: `user_id: user.id` → `user_id: userId`
- Line 201: `.eq("user_id", user.id)` → `.eq("user_id", userId)`
- Plus any other occurrences found on full scan

### Fix 2: Detached audio element (autoplay policy)
**File:** `src/hooks/useVoiceEngine.ts`
- Append the `<audio>` element to `document.body` so browsers honor autoplay
- Remove it on cleanup
- Add `playsinline` attribute for mobile Safari

### Fix 3: Add diagnostic logging
**File:** `src/hooks/useVoiceEngine.ts`
- Log all data channel message types received (not just handled ones) to diagnose whether OpenAI is sending response events at all
- Log when audio element play() is called and whether it succeeds or fails

### Fix 4: Model fallback consideration
- Verify `gpt-4o-mini-realtime-preview` is still active. If not, update to `gpt-4o-realtime-preview` or the current equivalent.
- This would be in both `useVizzyVoiceEngine.ts` (line 434) and `voice-engine-token/index.ts` (line 13 default)

---

## Priority Order
1. Fix 1 (pre-digest crash) — immediate, clear bug
2. Fix 2 (audio element) — most likely root cause of no response
3. Fix 3 (logging) — needed to confirm if Fix 2 resolves the issue
4. Fix 4 (model) — contingency if Fixes 1-2 don't resolve

