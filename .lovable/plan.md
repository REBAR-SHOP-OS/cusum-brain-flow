

## Plan: Move DockChatBar Floating Button to Portal Layer

### Problem
The floating chat button in `DockChatBar` renders inline with `fixed z-[9998]` instead of using the shared `getFloatingPortalContainer()` portal. When drawers, modals, or side panels open, Radix creates overlay portals that can block pointer events on the chat button, making it unresponsive. The Vizzy and Screenshot buttons already use the portal and work correctly.

### Changes

**`src/components/chat/DockChatBar.tsx`:**
- Import `createPortal` from `react-dom` and `getFloatingPortalContainer` from `@/lib/floatingPortal`
- Wrap the floating chat button `<div>` (and the `DockChatBox` windows) in `createPortal(..., getFloatingPortalContainer())` so it renders inside the `#floating-layer` div that always stays as the last child of `<body>`, above all Radix overlays
- Add `pointer-events: auto` on the button container (the portal root has `pointer-events: none`)
- Add `data-feedback-btn="true"` attribute so screenshot capture excludes it

This is a single-file change. The existing draggable logic, Popover, and DockChatBox rendering all stay the same — they just render through the portal instead of inline.

