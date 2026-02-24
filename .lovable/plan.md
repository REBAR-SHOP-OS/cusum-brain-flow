

## Fix: Enlarge Microphone Icon in Screenshot Feedback Modal

### Problem
The microphone button for speech-to-text in the screenshot feedback modal (`AnnotationOverlay`) uses `size="icon"` (40x40px) with a `w-4 h-4` icon (16x16px), making it too small and hard to tap.

### Change
**File: `src/components/feedback/AnnotationOverlay.tsx`**

Increase the voice button and icon size:
- Button: Change from `size="icon"` + `className="shrink-0"` to `size="icon"` + `className="shrink-0 !w-14 !h-14"` (56x56px)
- Mic icon (line 400): Change `w-4 h-4` to `w-7 h-7`
- MicOff icon (line 398): Change `w-4 h-4` to `w-7 h-7`

This only affects the microphone button in the feedback annotation modal. No other elements are touched.
