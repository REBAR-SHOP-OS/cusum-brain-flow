
# Fix Screenshot Capture + Make Floating Buttons Draggable

## Problem 1: Screenshot Doesn't Capture Notices
The screenshot tool captures `#main-content`, which has `overflow-hidden` on it. Content that is scrolled below the visible viewport (like overdue notices further down the page) gets clipped. html2canvas needs to be told to capture the full scrollable height.

**Fix**: Instead of capturing the `#main-content` element directly (which clips at the viewport), find the scrollable child inside it and configure html2canvas to capture the full scroll height by setting `scrollY: 0`, `windowHeight: target.scrollHeight`, and `height: target.scrollHeight`. This ensures the entire scrollable content, including notices below the fold, is captured.

## Problem 2: Make Camera and Chat Buttons Draggable
The camera (ScreenshotFeedbackButton) and chat (PublicChatWidget) buttons are fixed-position but not draggable. The Vizzy button already has a working drag implementation using pointer events and localStorage persistence -- we'll reuse that same pattern.

**Fix**: Create a shared `useDraggablePosition` hook extracted from the Vizzy button's drag logic, then apply it to:
- `ScreenshotFeedbackButton` (camera icon)
- `PublicChatWidget` (chat bubble) -- only on the landing page

Each button will have its own localStorage key so positions are remembered independently.

---

## Technical Details

### Files to Create
1. **`src/hooks/useDraggablePosition.ts`** -- Shared hook encapsulating:
   - `pos` state initialized from localStorage (with fallback default)
   - `onPointerDown`, `onPointerMove`, `onPointerUp` handlers
   - Drag threshold (5px) to distinguish tap from drag
   - Clamp to viewport on resize
   - Returns `{ pos, handlers, wasDragged }` so the consumer can skip onClick when dragged

### Files to Modify
1. **`src/components/feedback/ScreenshotFeedbackButton.tsx`**
   - Use `useDraggablePosition` hook with key `"feedback-btn-pos"` and default bottom-right position
   - Change the button from CSS `fixed bottom-24 right-6` to `fixed` with `left/top` from hook
   - Fix html2canvas call: find the scrollable container inside `#main-content`, then pass `scrollY: 0` and `height: scrollHeight` to capture full content including notices
   - Skip `capture()` if `wasDragged` is true (so dragging doesn't trigger screenshot)

2. **`src/components/landing/PublicChatWidget.tsx`**
   - Use `useDraggablePosition` hook with key `"chat-widget-pos"` and default bottom-right position
   - Apply drag handlers to the floating bubble button
   - Position the chat panel relative to the bubble's dragged position
   - Skip toggle if `wasDragged` is true

3. **`src/components/vizzy/FloatingVizzyButton.tsx`** (optional refactor)
   - Refactor to use the same shared `useDraggablePosition` hook to reduce duplication
