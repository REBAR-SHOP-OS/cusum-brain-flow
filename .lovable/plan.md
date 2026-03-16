

# Fix: Floating Buttons Always Draggable Over Overlays

## Problem
The three floating buttons (Vizzy avatar, camera feedback, mic) have `z-[9999]` but when a Radix overlay (Dialog, Sheet, Drawer) opens, its overlay element (`fixed inset-0 z-50`) captures pointer events and blocks dragging. Even though the buttons are visually on top, the Radix portal's event handling intercepts pointer interactions.

## Solution
Add a global CSS rule that ensures elements with `z-[9999]` always receive pointer events, regardless of Radix overlays. This is done by:

### 1. `src/index.css` — Add global pointer-events override
Add a CSS rule that targets `[data-feedback-btn]` elements and the floating Vizzy container to ensure they always have `pointer-events: auto` and sit above Radix portals:

```css
/* Ensure floating buttons remain interactive over Radix overlays */
[data-radix-portal] ~ .fixed.z-\[9999\],
[data-feedback-btn="true"] {
  pointer-events: auto !important;
}
```

### 2. `src/components/vizzy/FloatingVizzyButton.tsx` — Add `data-feedback-btn` attribute
Add `data-feedback-btn="true"` to the Vizzy wrapper `<div>` so it's also covered by the CSS rule, matching the pattern already used by the camera button.

### 3. `src/components/feedback/FloatingMicButton.tsx` — Already has `data-feedback-btn`
Already correct — no changes needed.

### 4. Move floating buttons to render via a **top-level portal**
The real fix: render all three floating buttons via `ReactDOM.createPortal(…, document.body)` so they sit **outside** and **after** any Radix portal in the DOM. This ensures they naturally receive pointer events since they're later siblings in the DOM tree with higher z-index.

Changes:
- **`FloatingVizzyButton.tsx`**: Wrap the return JSX in `createPortal(…, document.body)`
- **`ScreenshotFeedbackButton.tsx`**: Wrap the button (not the overlay) in `createPortal(…, document.body)`
- **`FloatingMicButton.tsx`**: Wrap in `createPortal(…, document.body)`

This is the cleanest approach — it avoids CSS hacks and ensures the buttons are always in the topmost DOM layer, above all Radix portals.

