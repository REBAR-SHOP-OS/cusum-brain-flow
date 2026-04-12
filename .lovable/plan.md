

# Fix: Audio Output Not Playing on Mobile (Vizzy Live)

## Root Cause

The WebRTC audio element in `useVizzyRealtimeVoice.ts` is created during `startSession` but the remote audio track arrives **asynchronously** via `pc.ontrack` — by that point the user gesture context has expired. Mobile Safari and Chrome block `audio.play()` calls outside a direct user gesture, so the OpenAI Realtime audio never plays.

The existing `primeMobileAudio()` in `VizzyLive.tsx` primes a **separate** Audio element that's never connected to the WebRTC stream.

## Fix

### 1. `src/hooks/useVizzyRealtimeVoice.ts`
- **Prime the audio element immediately** at the start of `startSession` (synchronous, within user gesture) by playing a silent WAV via `SILENT_WAV` from `audioPlayer.ts`
- After priming succeeds, the element is "gesture-unlocked" — when `ontrack` fires later, just assign `srcObject` without needing another `play()` call
- Add a fallback: if `play()` in `ontrack` is blocked, surface the `outputAudioBlocked` state so the UI can show a "tap to hear" button

### 2. `src/components/vizzy/VizzyVoiceChat.tsx`
- Check `outputAudioBlocked` from the engine and show a "Tap to hear Vizzy" overlay button that calls `retryOutputAudio()`

### 3. `src/pages/VizzyLive.tsx`
- No changes needed — the prime button already exists but will now serve as the gesture gate for the hook's internal priming

## Technical Detail

```typescript
// In startSession, BEFORE any async work:
const audioEl = document.createElement("audio");
audioEl.autoplay = true;
audioEl.setAttribute("playsinline", "true");
audioEl.src = SILENT_WAV;
await audioEl.play(); // gesture-unlocked
audioEl.pause();
audioEl.src = "";
audioElRef.current = audioEl;

// Later in ontrack:
pc.ontrack = (ev) => {
  audioEl.srcObject = ev.streams[0];
  audioEl.play().catch(() => setOutputAudioBlocked(true));
};
```

## Files
| File | Action |
|------|--------|
| `src/hooks/useVizzyRealtimeVoice.ts` | Edit — prime audio element in gesture context |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Edit — add "tap to hear" fallback button |

## Risk
- Minimal — uses the same proven `SILENT_WAV` pattern already in `audioPlayer.ts`
- No backend changes

