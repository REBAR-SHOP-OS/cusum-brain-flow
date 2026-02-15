
## Fix: Audio and Ringtone Playback Failures

### Root Cause

Mobile browsers (especially iOS Safari) **block `audio.play()`** unless it happens during a direct user tap/click. The app has two categories of audio:

1. **User-initiated playback** (recording playback, TTS) -- these are triggered by button clicks but the `await fetch()` before `audio.play()` breaks the "user gesture" chain on iOS, causing the play call to be rejected.
2. **Background notification sounds** (`playMockingjayWhistle`) -- these fire from realtime subscription callbacks with no user gesture at all, so they are always blocked on mobile.

Additionally, `playMockingjayWhistle()` silently swallows all errors (`catch {}`) so failures are invisible.

### Solution: Audio Unlock Pattern

Create a shared audio utility that:
- **Pre-unlocks** the Web Audio context on the user's first tap anywhere on the page
- Provides a reliable `playSound()` function that works on mobile
- For user-initiated playback (recordings/TTS), pre-creates the `Audio` element during the click handler *before* the async fetch

### Changes

**1. New file: `src/lib/audioPlayer.ts`**

A shared audio utility with:
- `unlockAudio()` -- called once on first user interaction (`touchstart`/`click`) to create and resume an `AudioContext` and play a silent buffer. This permanently unlocks audio for the page session.
- `playNotificationSound(url)` -- plays a sound using the unlocked audio context (works for background notifications)
- `createPreloadedPlayer()` -- returns an Audio element created synchronously during user gesture, with a `.loadAndPlay(url)` method for deferred src assignment

The unlock listener is attached once on import via `document.addEventListener("click", unlockAudio, { once: true })`.

**2. Update: `src/lib/notificationSound.ts`**

Replace:
```typescript
const audio = new Audio("/mockingjay.mp3");
audio.play();
```
With:
```typescript
import { playNotificationSound } from "./audioPlayer";
playNotificationSound("/mockingjay.mp3");
```

This uses the pre-unlocked AudioContext so notification sounds work even without a direct user gesture.

**3. Update: `src/pages/Phonecalls.tsx` (recording playback)**

Before the `await fetch()`, create the Audio element synchronously (while still in the click handler's microtask):
```typescript
const audio = new Audio();       // created during user gesture
audio.crossOrigin = "anonymous";
// ... fetch blob ...
audio.src = blobUrl;             // assign src after fetch
await audio.play();              // works because element was created in gesture
```
This is already nearly correct in the current code -- just need to ensure the Audio() constructor is called before any await.

**4. Update: `src/components/inbox/CallDetailView.tsx`**

Same pattern: move `new Audio()` before the `await fetch()` call so it's created in the user gesture context.

**5. Update: `src/components/inbox/InlineCallSummary.tsx`**

Same pattern as above.

**6. Update: `src/components/teamhub/MessageThread.tsx` (TTS playback)**

Same pattern: create `new Audio()` before `await fetch()` to the TTS endpoint.

### Technical Details

**`src/lib/audioPlayer.ts`** (new file):
- On first click/touch, create a Web `AudioContext`, play a silent buffer to unlock it, then keep the context alive
- `playNotificationSound(url)`: fetch the audio file as ArrayBuffer, decode it via the AudioContext, and play through a BufferSourceNode -- this bypasses the `HTMLAudioElement.play()` autoplay restriction
- Fallback: if AudioContext is unavailable, try `new Audio(url).play()` with `.catch(() => {})` to avoid unhandled rejections

**Recording/TTS files** (4 files):
- Move `const audio = new Audio()` to before any `await` statement in the click handler
- This keeps audio element creation within the synchronous part of the user gesture

**`src/lib/notificationSound.ts`**:
- Switch to the AudioContext-based approach from `audioPlayer.ts`
- Add `.catch()` logging so failures are visible in console instead of silently swallowed
