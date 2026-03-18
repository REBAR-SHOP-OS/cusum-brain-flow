

## Plan: Prevent Floating Icon Drag from Closing Drawers/Modals

### Problem
When dragging floating icons (Vizzy, Mic, Chat, Screenshot), the `pointerdown` event propagates to Radix UI's dismiss layer, which interprets it as an "outside click" and closes any open drawer/modal/sheet.

### Root Cause
Radix UI listens for `pointerdown` events on the document to detect clicks outside dialogs. The floating buttons use `e.stopPropagation()` but Radix uses native event listeners that require `stopImmediatePropagation()` on the native event.

### Fix
Two changes:

1. **`src/lib/floatingPortal.ts`** — Add a `pointerdown` event listener on the `#floating-layer` container that calls `stopImmediatePropagation()` only when the target has `data-feedback-btn="true"` or is inside such an element. This is a single centralized fix that protects all floating buttons.

2. **`src/hooks/useDraggablePosition.ts`** — Update `onPointerDown` to also call `e.nativeEvent.stopImmediatePropagation()` as a safety net.

### Files to Modify
| File | Change |
|------|--------|
| `src/lib/floatingPortal.ts` | Add native `pointerdown` listener on container to `stopImmediatePropagation` for feedback buttons |
| `src/hooks/useDraggablePosition.ts` | Add `stopImmediatePropagation` in `onPointerDown` |

