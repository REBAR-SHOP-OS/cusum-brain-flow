

## Make Mic Button a Floating Draggable Icon (Like the Camera Button)

### Idea

The user wants the mic button to be a separate floating, draggable button — just like the existing camera icon — sitting outside the annotation dialog, always accessible on screen. This makes it trivially easy to tap with gloves on the shop floor.

### Current State

- The camera button (`ScreenshotFeedbackButton.tsx`) is a fixed-position, draggable 40px circle using `useDraggablePosition` hook.
- The mic button is inside the `AnnotationOverlay` dialog at the bottom, only visible after a screenshot is taken.

### Problem

Shop floor workers need to quickly voice-describe issues. Currently they must: tap camera → wait for screenshot → then find the mic button inside the overlay. The mic should be just as accessible as the camera.

### Plan

**New file: `src/components/feedback/FloatingMicButton.tsx`**

Create a floating, draggable mic button similar to the camera button:
- Uses the same `useDraggablePosition` hook with a different `storageKey` (`"feedback-mic-pos"`)
- Default position: offset from the camera button (e.g., 60px above it)
- Size: 56px (`w-14 h-14`) — larger than the camera (40px) for glove-friendly tapping
- Uses the same `useSpeechRecognition` hook already in use
- On tap: toggles voice recording on/off
- Pulses red when recording, teal/primary when idle
- Stores transcript text; when recording stops, opens the `AnnotationOverlay` with a blank/minimal screenshot and the transcript pre-filled in the description

**Modify: `src/components/feedback/AnnotationOverlay.tsx`**

- Accept an optional `initialDescription` prop so the floating mic can pass in the voice transcript
- Initialize `description` state with `initialDescription` when provided

**Modify: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

- Render `<FloatingMicButton />` alongside the camera button
- Pass `onRecordingComplete` callback that triggers a screenshot capture and opens the overlay with the transcript pre-filled

### Visual Layout

```text
Screen edge (bottom-right area):

  🎤  ← Floating mic (56px, draggable, red pulse when recording)
  📷  ← Existing camera button (40px, draggable)
```

Both independently draggable and repositionable. The mic is bigger for glove use.

### Flow

1. Worker taps floating mic → it turns red, starts recording
2. Worker speaks (Farsi or English)
3. Worker taps mic again → recording stops
4. System auto-captures screenshot + opens annotation overlay with transcript pre-filled
5. Worker can draw on screenshot, edit text, then hit Send

### Technical Details

- `FloatingMicButton` uses `useDraggablePosition({ storageKey: "feedback-mic-pos", btnSize: 56 })`
- Uses `useSpeechRecognition({ lang: "fa-IR" })` from existing hook
- On stop: calls parent callback with transcript text
- Parent (`ScreenshotFeedbackButton`) runs `capture()` then opens overlay with `initialDescription`
- The mic button inside the overlay remains as a secondary option for additional voice input after annotation

### Files Changed
1. **New**: `src/components/feedback/FloatingMicButton.tsx`
2. **Edit**: `src/components/feedback/AnnotationOverlay.tsx` — add `initialDescription` prop
3. **Edit**: `src/components/feedback/ScreenshotFeedbackButton.tsx` — render `FloatingMicButton`, wire up callback

