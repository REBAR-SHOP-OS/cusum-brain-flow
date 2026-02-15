

## Fix: Notification Sound Still Not Playing on Other Devices

### Root Cause

The current audio unlock pattern in `audioPlayer.ts` has three bugs that cause it to silently fail on many mobile devices:

1. **`{ once: true }` kills retries**: The unlock listeners fire only on the very first click/touch. If that first interaction happens before the module is loaded, or the AudioContext creation fails for any reason, unlock never happens again.

2. **Premature `unlocked = true`**: The flag is set to `true` immediately after creating the AudioContext, even if `audioCtx.state` is still `"suspended"`. The `resume()` call is fire-and-forget (`catch(() => {})`), so on iOS Safari the context often stays suspended and all subsequent `playNotificationSound()` calls silently fail.

3. **No pre-loading**: Each notification fetches `mockingjay.mp3` from the network via `fetch()` + `decodeAudioData()`. On slow connections or first-time loads, there's a noticeable delay or timeout, and the sound never plays.

### Fixes

**1. Robust unlock in `src/lib/audioPlayer.ts`**

- Remove `{ once: true }` -- keep listening until unlock actually succeeds
- Only set `unlocked = true` after confirming `audioCtx.state === "running"`
- After successful unlock, pre-fetch and cache the mockingjay.mp3 AudioBuffer so it's ready instantly
- Add `await audioCtx.resume()` (not fire-and-forget) inside the unlock function
- Manually remove listeners only after confirmed unlock

**2. Cache the decoded audio buffer**

- Store the decoded `AudioBuffer` for `/mockingjay.mp3` in a module-level variable after the first successful decode
- On subsequent plays, skip the `fetch()` + `decodeAudioData()` and play directly from cache
- This eliminates network latency on repeat notifications

**3. Add console logging for diagnostics**

- Log `[audioPlayer] unlocked` when the context transitions to running
- Log `[audioPlayer] playing from cache` vs `[audioPlayer] fetching audio` so failures are visible in console on all devices

### Technical Details

**File: `src/lib/audioPlayer.ts`** (rewrite)

```text
Changes:
- unlockAudio(): 
  - await audioCtx.resume() instead of fire-and-forget
  - Check audioCtx.state === "running" before setting unlocked = true
  - If state is not running, don't set unlocked (listener stays active for next interaction)
  - On success, remove listeners manually and pre-cache mockingjay.mp3
  
- audioBufferCache: Map<string, AudioBuffer> for decoded buffer caching

- playNotificationSound(url):
  - Check cache first, skip fetch if buffer exists
  - If not cached, fetch + decode + cache
  - Fallback: try HTMLAudioElement with .play()
```

No other files need changes -- `notificationSound.ts` and `useNotifications.ts` already call the right functions.
