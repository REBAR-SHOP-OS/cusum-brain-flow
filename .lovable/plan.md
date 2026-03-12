

# Fix: Screenshot Must Capture Exactly What User Sees (Including Open Dropdowns/Popovers)

## Problem
When the screenshot button is clicked, Radix UI detects the click as an "outside click" and closes any open popovers, dropdowns, or dialogs **before** the screenshot is captured. The user sees one thing, but the screenshot captures a different state (with everything closed).

## Root Cause
Radix UI listens for `pointerdown` events at the document level to detect clicks outside open overlays. The feedback button's `pointerdown` event bubbles up and triggers Radix's dismiss logic, closing all open overlays before `capture()` runs on `pointerup`.

## Fix — Two changes in `ScreenshotFeedbackButton.tsx`

### 1. Stop event propagation on pointerdown
Add `e.nativeEvent.stopImmediatePropagation()` to prevent Radix's document-level listener from firing and closing overlays.

### 2. Delay capture slightly
Add a `requestAnimationFrame` guard so the DOM state is preserved at the moment of capture, not after any dismissal has started.

### Changes in `handlePointerUp`:
```typescript
const handlePointerUp = useCallback((e: React.PointerEvent) => {
  handlers.onPointerUp(e);
  if (!wasDragged.current) {
    setInitialDescription("");
    capture();
  }
}, [handlers, capture, wasDragged]);
```

### Changes in button's `onPointerDown`:
Wrap the existing `handlers.onPointerDown` to also call `e.nativeEvent.stopImmediatePropagation()`:
```typescript
onPointerDown={(e) => {
  e.nativeEvent.stopImmediatePropagation();
  handlers.onPointerDown(e);
}}
```

This prevents Radix from seeing the click as "outside" and keeps all open UI elements intact during capture.

**Single file change:** `src/components/feedback/ScreenshotFeedbackButton.tsx`

