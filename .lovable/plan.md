

## Fix: Audio Still Not Playing on iPhone 12

### Root Cause

On iOS Safari, creating `new Audio()` before an `await` is **not enough**. iOS requires `.play()` itself to be called synchronously within the user gesture. Any `await` (like `fetch`) between the tap and `.play()` breaks the gesture chain, and iOS silently rejects the play call.

The current code does:
```
tap -> new Audio() -> await fetch(...) -> audio.play()  // REJECTED by iOS
```

### Solution

Two-pronged fix:

**1. "Prime and replay" pattern for user-initiated audio (recordings, TTS)**

Instead of just creating the Audio element early, we must also call `.play()` synchronously during the gesture with a tiny silent audio data URI. After the async fetch completes, we pause, swap the src, and play again. iOS now considers the element "user-activated" and allows subsequent plays.

```
tap -> audio.src = silentDataURI -> audio.play() -> await fetch(...) -> audio.pause() -> audio.src = realBlob -> audio.play()  // ALLOWED
```

**2. Improve AudioContext unlock resilience for notification sounds**

Add an `"interrupted"` state handler on the AudioContext. iOS Safari suspends the context when switching tabs or after the screen locks. We need to re-resume it before each playback attempt and re-attach unlock listeners if the context gets interrupted.

### Changes

**File: `src/lib/audioPlayer.ts`**
- Add a tiny silent WAV as a base64 data URI constant
- Export a new helper `primeMobileAudio()` that returns an Audio element already "primed" with a synchronous `.play()` call on the silent source
- Add `statechange` listener on AudioContext to detect iOS interruptions and re-unlock
- On `playNotificationSound`, always try `audioCtx.resume()` first even if `unlocked` is true (handles iOS tab-switch suspensions)

**File: `src/components/inbox/CallDetailView.tsx`**
- Replace `const audio = new Audio()` with the prime-and-replay pattern:
  - Synchronously set silent data URI and call `.play()` 
  - After fetch, pause, set blob URL, and play again

**File: `src/components/inbox/InlineCallSummary.tsx`**
- Same prime-and-replay pattern

**File: `src/components/teamhub/MessageThread.tsx`**
- Same prime-and-replay pattern for TTS playback

**File: `src/pages/Phonecalls.tsx`**
- Same prime-and-replay pattern for recording playback

### Technical Details

**Silent WAV data URI** (used for priming):
```typescript
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
```

**Prime pattern** (applied to all 4 playback files):
```typescript
const audio = new Audio(SILENT_WAV);
audio.play(); // Synchronous call during user gesture - primes the element
// ... await fetch() ...
audio.pause();
audio.src = blobUrl;
await audio.play(); // Now allowed by iOS
```

**AudioContext interruption recovery** (in audioPlayer.ts):
```typescript
audioCtx.addEventListener("statechange", () => {
  if (audioCtx.state === "suspended") {
    unlocked = false;
    // Re-attach gesture listeners to re-unlock on next tap
    document.addEventListener("click", unlockAudio, true);
    document.addEventListener("touchstart", unlockAudio, true);
  }
});
```

