

# Fix: Confirm Mapping Button Still Inaccessible on iOS

## Problem

The `sticky bottom-0` fix doesn't work because the Card component is inside a parent scroll container (`main.flex-1.overflow-auto` in OfficePortal). The sticky positioning is relative to the wrong scroll ancestor, so on iOS the button remains off-screen.

## Fix

Change the Card layout so that the **Card itself becomes the scroll container** for the preview table, and the confirm button sits **outside** the scrollable area — always visible at the bottom.

### Changes in `src/components/office/BarlistMappingPanel.tsx`

1. Wrap the Card in a flex column with `max-h-[80vh]` so it doesn't exceed the viewport
2. Move the preview table into its own `overflow-auto flex-1` scrollable div inside CardContent
3. Move the confirm button **outside** the scrollable div — it becomes a fixed footer within the Card (no sticky needed)

Specifically:
- The Card gets `flex flex-col max-h-[80vh]`
- The mapping grid + preview table go inside a `flex-1 overflow-auto` wrapper
- The confirm button div moves below that wrapper, still inside CardContent but outside the scroll area
- Remove `sticky` classes from the button container; add `pt-3 border-t` for visual separation
- Keep `pb-[env(safe-area-inset-bottom)]` for iOS safe area

This guarantees the button is always visible regardless of how long the preview table is.

