

# Add Voice Chat to Floating Vizzy Button

## Summary

Re-introduce long-press on the floating Vizzy button to launch voice chat mode. Tap still opens text chat (`/chat`), but holding the button activates voice mode directly by navigating to `/chat?voice=1`.

## How It Works

1. **Short tap** (no movement, < 500ms hold): Navigate to `/chat` (text mode, same as today)
2. **Long press** (hold > 500ms without moving): Navigate to `/chat?voice=1` to auto-activate voice mode
3. **Drag**: Reposition the button (unchanged)

The `/chat` page (`LiveChat.tsx`) reads the `?voice=1` query param on mount and automatically enables voice mode.

## Changes

### `src/components/vizzy/FloatingVizzyButton.tsx`
- Add a `LONG_PRESS_MS = 500` constant
- Add `longPressTimer` ref and `isLongPress` ref
- On pointer down: start a 500ms timer that sets `isLongPress = true`
- On pointer move (beyond drag threshold): clear the timer (it's a drag)
- On pointer up (no drag):
  - If `isLongPress`: navigate to `/chat?voice=1`
  - Else: navigate to `/chat` (existing behavior)
- Update tooltip text: "Tap to chat - Hold for voice"

### `src/pages/LiveChat.tsx`
- On mount, read `URLSearchParams` for `voice` param
- If `voice=1`, set `voiceMode` to `true` automatically
- Remove the query param from the URL after reading (clean URL)

## Files

| Action | File |
|--------|------|
| Modify | `src/components/vizzy/FloatingVizzyButton.tsx` -- add long-press logic |
| Modify | `src/pages/LiveChat.tsx` -- read `?voice=1` query param on mount |

