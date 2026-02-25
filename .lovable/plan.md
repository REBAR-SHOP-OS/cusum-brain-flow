

## Fix Floating Mic: Stop Closing Overlay + Remove Inner Mic

### Problem
1. Clicking the floating mic button closes the annotation overlay (Radix Dialog detects it as an outside click)
2. There are two mic buttons — the floating one and the one inside the overlay. User wants only the floating one.
3. The floating mic currently triggers a new screenshot capture instead of just feeding voice into the open overlay's textarea.

### Plan

**File 1: `src/components/feedback/FloatingMicButton.tsx`** — Rewire to toggle voice only

- Change props: instead of `onRecordingComplete`, accept `onToggleVoice`, `isListening`, and `isSupported`
- On tap, just call `onToggleVoice()` — no own speech recognition, no capture trigger
- Add `onPointerDown` → `e.stopPropagation()` to prevent Radix Dialog from closing
- Keep draggable behavior

**File 2: `src/components/feedback/AnnotationOverlay.tsx`** — Remove inline mic, expose speech controls

- Remove the mic `<Button>` from the bottom bar (lines 396–417)
- Keep the speech recognition logic and interim text display
- Add new props: `onSpeechReady?: (controls: { toggle: () => void; isListening: boolean; isSupported: boolean }) => void`
- Actually simpler: accept `externalToggleRef` — a ref that the parent can call to toggle voice
- Even simpler: just expose `toggleVoice` / `isListening` / `isSupported` via new props passed back up through a callback

**Simplest approach — lift speech toggle to parent:**

- `AnnotationOverlay` adds a new prop: `speechControlRef?: React.MutableRefObject<{ toggle: () => void; isListening: boolean; isSupported: boolean } | null>`
- On mount, it assigns `speechControlRef.current = { toggle: toggleVoice, isListening: speech.isListening, isSupported: speech.isSupported }`
- Remove the inline mic button from the overlay UI

**File 3: `src/components/feedback/ScreenshotFeedbackButton.tsx`** — Wire floating mic to overlay's speech

- Create a `speechControlRef` and pass it to `AnnotationOverlay`
- Pass `onToggleVoice` / `isListening` / `isSupported` from the ref to `FloatingMicButton`
- Remove `handleMicComplete` (no longer needed — mic doesn't trigger captures)

### Result

```text
┌─────────────────────────────────────────────┐
│  Annotate & Describe the Change          ✕  │
│  🔴 🔵 🟡  Undo  Clear                     │
│  ┌───────────────────────────────────────┐  │
│  │          Canvas (screenshot)          │  │
│  └───────────────────────────────────────┘  │
│  ┌──────────────────────────┐ ┌──────────┐  │
│  │  Describe the change...  │ │  ➤ Send  │  │  ← No more inline mic
│  └──────────────────────────┘ └──────────┘  │
└─────────────────────────────────────────────┘

     🎤  ← Floating mic (draggable, controls the overlay's voice)
     📷  ← Camera button (always visible)
```

### Files Changed
1. `src/components/feedback/FloatingMicButton.tsx` — new props, no own speech, stopPropagation
2. `src/components/feedback/AnnotationOverlay.tsx` — remove inline mic, expose speech via ref
3. `src/components/feedback/ScreenshotFeedbackButton.tsx` — wire ref between overlay and floating mic

