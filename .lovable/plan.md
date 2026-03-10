

# Fix: "Confirm Mapping" Button Not Accessible on iOS

## Problem

The "Confirm Mapping" button at the bottom-right of the `BarlistMappingPanel` is cut off or hidden on iOS devices. The button sits at the very end of the card content with no bottom padding/margin, and on mobile viewports it falls behind the browser chrome or gets clipped by the scroll container.

## Fix

1. **Add bottom safe-area padding** to the confirm button container so it clears iOS browser chrome:
   - Add `pb-safe` / `pb-20` bottom padding to the `CardContent` wrapper
   - Make the button container sticky at the bottom with a background, so it's always visible regardless of scroll position

2. **Make the confirm button sticky on mobile**:
   - Wrap the confirm button div in a `sticky bottom-0` container with a background gradient/solid so it floats above the preview table content
   - Add `pb-[env(safe-area-inset-bottom)]` for iOS safe area

### Changes

**`src/components/office/BarlistMappingPanel.tsx`** — Lines 324-341:
- Change the confirm button wrapper from a plain `div` to a `sticky bottom-0 bg-card pt-3 pb-4` container
- Add `pb-[env(safe-area-inset-bottom,1rem)]` for iOS safe area inset
- Add a top border/shadow to visually separate it from scrollable content

