

# Max-Tech Vizzy Voice Chat Upgrade

## Current Issues Found

1. **No voice button in the LiveChat page** -- users on `/chat` have no way to start voice chat
2. **Missing `onStatusChange` callback** -- the hook manually tracks state but ignores the SDK's built-in status events (`connecting`, `connected`, `disconnected`, `disconnecting`), causing state mismatches
3. **No audio-reactive visualization** -- the orb pulses with CSS animations instead of reacting to actual audio volume levels via `getInputVolume()` / `getOutputVolume()`
4. **No `onModeChange` tracking** -- the SDK fires `speaking`/`listening` mode changes but the hook only checks `isSpeaking`, missing nuanced state
5. **No connection timeout** -- if the WebSocket hangs, users are stuck on "Connecting..." forever
6. **No `onDisconnect` details** -- the hook ignores disconnection reasons (error vs agent ended vs user ended)
7. **No volume control** -- users can't adjust Vizzy's voice volume

## Upgrade Plan

### 1. Upgrade `src/hooks/useVizzyVoice.ts` (Major Rewrite)

- Add `onStatusChange` callback to sync with SDK status precisely
- Add `onModeChange` to track speaking/listening mode
- Add `onDisconnect` with details handling (show different messages for error vs agent hangup)
- Add 15-second connection timeout that auto-cancels and shows retry
- Expose `getInputVolume` and `getOutputVolume` for real-time audio visualization
- Expose `setVolume` for output volume control
- Expose `sendUserActivity` to prevent interruption during UI interaction
- Return `mode` ("speaking" | "listening") alongside `isSpeaking`

### 2. Upgrade `src/components/vizzy/VizzyVoiceChat.tsx` (Visual Overhaul)

- **Audio-reactive orb**: Use `requestAnimationFrame` loop to poll `getInputVolume()` and `getOutputVolume()`, scaling the orb ring and glow intensity based on real audio levels (not CSS animations)
- **Waveform ring**: Render a circular waveform around the avatar using `getOutputByteFrequencyData()` for a Siri-like visual
- **Live status bar**: Show mode transitions smoothly -- "Listening...", "Vizzy is thinking...", "Vizzy is speaking..."
- **Volume slider**: Small slider at the bottom to control Vizzy's output volume
- **Connection timeout UI**: If connecting takes more than 10 seconds, show "Taking longer than expected..." with a cancel button
- **Disconnect reason toast**: If Vizzy hangs up or an error occurs, show a clear message
- **Haptic feedback on mobile**: Vibrate on connect/disconnect (navigator.vibrate)

### 3. Add Voice Button to `src/pages/LiveChat.tsx`

- Import `Mic` icon and `VizzyVoiceChat` component
- Add `showVoiceChat` state
- Add a teal mic button in the header bar (next to the trash/clear button)
- Render `VizzyVoiceChat` overlay when active
- This gives users a direct path from text chat to voice chat

---

## Technical Details

### useVizzyVoice.ts -- New Return Shape

```typescript
return {
  voiceState,          // "idle" | "connecting" | "connected" | "error"
  transcripts,         // TranscriptEntry[]
  isSpeaking,          // boolean
  mode,                // "speaking" | "listening" | null
  status,              // SDK status
  getInputVolume,      // () => number (0-1, user mic level)
  getOutputVolume,     // () => number (0-1, Vizzy voice level)
  getOutputFrequency,  // () => Uint8Array (for waveform)
  setVolume,           // (vol: number) => void
  startSession,
  endSession,
};
```

### VizzyVoiceChat.tsx -- Audio-Reactive Animation

```typescript
// requestAnimationFrame loop for real-time audio visualization
useEffect(() => {
  let animId: number;
  const tick = () => {
    const input = getInputVolume();   // user mic level 0-1
    const output = getOutputVolume(); // vizzy voice level 0-1
    setInputLevel(input);
    setOutputLevel(output);
    animId = requestAnimationFrame(tick);
  };
  if (voiceState === "connected") {
    animId = requestAnimationFrame(tick);
  }
  return () => cancelAnimationFrame(animId);
}, [voiceState]);

// Orb scale reacts to audio level
<div style={{
  transform: `scale(${1 + outputLevel * 0.3})`,
  boxShadow: `0 0 ${40 + outputLevel * 60}px ${outputLevel * 20}px rgba(45, 212, 191, ${0.2 + outputLevel * 0.4})`
}}>
```

### LiveChat.tsx -- Header Mic Button

```typescript
const [showVoiceChat, setShowVoiceChat] = useState(false);

// In header, next to trash button:
<Button variant="ghost" size="icon" className="h-9 w-9"
  onClick={() => setShowVoiceChat(true)} title="Voice chat">
  <Mic className="w-4 h-4 text-teal-400" />
</Button>

// At component root:
{showVoiceChat && <VizzyVoiceChat onClose={() => setShowVoiceChat(false)} />}
```

### Files to Modify
1. `src/hooks/useVizzyVoice.ts` -- Full upgrade with all SDK callbacks + volume APIs
2. `src/components/vizzy/VizzyVoiceChat.tsx` -- Audio-reactive UI with waveform, volume slider, timeout handling
3. `src/pages/LiveChat.tsx` -- Add mic button + voice chat overlay

