

## Show Mic Button Only When Annotation Overlay Is Open

### Problem
The floating mic button is always visible on screen. The user wants it to only appear when the screenshot overlay is open (after tapping the camera), and disappear when the overlay closes.

### Change

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

Conditionally render `<FloatingMicButton />` only when `overlayOpen` is true — the same flag that controls the `AnnotationOverlay`.

Current (line 201):
```tsx
<FloatingMicButton onRecordingComplete={handleMicComplete} />
```

Change to:
```tsx
{overlayOpen && <FloatingMicButton onRecordingComplete={handleMicComplete} />}
```

That's it — one line change. The mic appears when the screenshot overlay opens and unmounts when it closes.

### What does NOT change
- FloatingMicButton component itself
- AnnotationOverlay, voice logic, screenshot capture
- The camera button remains always visible

