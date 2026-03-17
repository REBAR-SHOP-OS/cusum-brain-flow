

## Fix: Make Floating Buttons Draggable Over Drawers/Modals

### Problem
The floating Vizzy and Camera buttons are portaled to `document.body`, but Radix drawer/sheet/dialog overlays are also portaled to `document.body` and render **after** the floating buttons in DOM order. Even though the buttons have `z-index: 9999`, the Radix overlay (`fixed inset-0`) captures all pointer events, blocking drag interactions.

### Solution
Two changes needed:

**1. CSS: Ensure `data-feedback-btn` elements sit above Radix portals**

In `src/index.css`, the existing rule already sets `z-index: 9999` and `pointer-events: auto`. Add `position: relative` to create a stacking context, and add a rule to make Radix overlays pass through pointer events to elements beneath them when a floating button is being dragged:

```css
/* Ensure floating buttons beat Radix portal stacking */
[data-feedback-btn="true"] {
  pointer-events: auto !important;
  z-index: 99999 !important;
}
```

Bump from `9999` to `99999` since Radix portals can stack up to `z-50` (50) but some custom modals may go higher.

**2. Fix DOM ordering: Append floating buttons LAST**

The core issue is DOM order. Radix portals append after our buttons. Fix by using a dedicated portal container that is always the last child of `body`:

- In `useDraggablePosition` or the floating button components, ensure the portal target is a persistent `div#floating-layer` appended as the **last child** of `document.body`
- Create a small utility `getFloatingPortalContainer()` that lazily creates this div with `z-index: 99999; position: fixed; inset: 0; pointer-events: none;`
- Both `FloatingVizzyButton` and `ScreenshotFeedbackButton` portal into this container instead of `document.body` directly
- Since the container has `pointer-events: none`, only the buttons themselves (with `pointer-events: auto`) will be interactive

### Files to Modify
- `src/index.css` — Bump z-index to 99999
- `src/components/feedback/FloatingMicButton.tsx` — Portal to floating layer container
- `src/components/feedback/ScreenshotFeedbackButton.tsx` — Portal to floating layer container  
- `src/components/vizzy/FloatingVizzyButton.tsx` — Portal to floating layer container
- Create `src/lib/floatingPortal.ts` — Shared utility to get/create the persistent floating layer div

