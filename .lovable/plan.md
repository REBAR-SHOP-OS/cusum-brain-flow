

## Plan: Fix Floating Icon Draggability Over Drawers/Modals

### Problem
The 3 floating icons (Camera, Chat, Vizzy) cannot be dragged when a Sheet/Drawer is open. Two issues:
1. Radix UI's `DismissableLayer` listens for `pointerdown` on `document` in the **capture phase** — it fires *before* our container-level listener, detects an "outside click", and closes the drawer.
2. Once the drawer closes, the drag gesture is interrupted.

### Root Cause
The current `floatingPortal.ts` adds a `pointerdown` capture listener on the **container element** (`#floating-layer`). But Radix registers its dismiss listener on `document` in the capture phase. Since `document` is an ancestor of the container, Radix's listener fires first and closes the sheet before our `stopImmediatePropagation` can prevent it.

### Fix

**File: `src/lib/floatingPortal.ts`**

Add a **`document`-level** capture listener for `pointerdown` that fires before Radix's listener. When the event target is inside a `[data-feedback-btn]` element, call `stopImmediatePropagation()` to prevent Radix from seeing the event.

```typescript
// Add once, at module level — fires before any Radix dismiss listener
document.addEventListener("pointerdown", (e) => {
  const target = e.target as HTMLElement;
  if (target?.closest?.("[data-feedback-btn]")) {
    e.stopImmediatePropagation();
  }
}, true); // capture phase
```

Also keep the existing container-level listener as a safety net, but the document-level one is the critical fix.

### Why This Works
- `document` capture-phase listeners fire in registration order
- Registering ours early (at module load time of `floatingPortal.ts`, which loads before any Radix components mount) ensures it runs before Radix's dismiss handler
- `stopImmediatePropagation()` prevents any subsequently-registered capture listeners on the same element (`document`) from firing
- The pointer event still reaches the floating button via normal propagation, so dragging works as expected

### Files Changed
- `src/lib/floatingPortal.ts` — Add document-level capture listener (single file, ~5 lines added)

