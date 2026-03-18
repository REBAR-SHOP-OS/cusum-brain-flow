

## Plan: ChatGPT-Style Real-Time Voice Button for AZIN

### What the User Wants
Replace the current flat mic button with a ChatGPT-style animated voice button that:
- Shows real-time audio waveform visualization when listening (like ChatGPT's blue pulsating circle)
- Looks like the uploaded reference image (blue circle with sound bars)
- Reacts to the user's actual voice volume in real-time

### Current State
- The mic button is a simple red/green circle with a static `animate-ping` effect
- `useRealtimeTranscribe` uses ElevenLabs Scribe but doesn't expose audio levels
- No audio analyser is connected to the microphone stream

### Changes

**1. New component: `src/components/azin/AzinVoiceOrb.tsx`**
A self-contained animated voice button that:
- Uses `navigator.mediaDevices.getUserMedia` to get a separate audio stream reference
- Connects a Web Audio `AnalyserNode` to extract real-time frequency data
- Renders an SVG/canvas-based circular visualizer with animated bars radiating from center (like ChatGPT)
- When idle: static blue circle with a mic icon
- When connected: animated blue orb with sound wave bars reacting to voice input
- When connecting: pulsating animation
- Uses `requestAnimationFrame` for smooth 60fps animation
- Taps into the same mic stream (or creates a parallel analyser) without interfering with ElevenLabs Scribe

**2. Update `src/pages/AzinInterpreter.tsx`**
- Replace the current `<button>` mic element with `<AzinVoiceOrb>`
- Pass `isConnected`, `isConnecting`, `onToggle` props

**3. Update `src/hooks/useRealtimeTranscribe.ts`**
- After `scribe.connect()`, store the MediaStream so the orb component can attach an AnalyserNode to it
- Expose `mediaStream` from the hook (or the orb creates its own parallel stream)

### Technical Approach
The orb will request its own audio stream reference for visualization only (the Scribe SDK handles its own stream separately). On connect, the orb starts analyzing; on disconnect, it stops and releases the stream. The visualization draws ~20 bars in a circular pattern using canvas, with bar heights driven by frequency bin amplitudes.

### Files to Change
1. `src/components/azin/AzinVoiceOrb.tsx` — new animated voice button component
2. `src/pages/AzinInterpreter.tsx` — swap mic button for orb
3. `src/hooks/useRealtimeTranscribe.ts` — minor: no change needed if orb manages its own stream

