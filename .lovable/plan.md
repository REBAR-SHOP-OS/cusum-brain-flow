

# Plan: Fix Slot Header Removal from Captions

## Problem
The regex that strips "### Slot ..." headers from captions doesn't match time-based slot formats like `### Slot 02:30 — Wire Mesh`. The current pattern expects `Slot` + digit (e.g., `Slot 1`), but the AI produces `Slot HH:MM`.

## Fix

### `src/components/social/PixelChatRenderer.tsx` (line ~102)
Replace the slot-header regex with a broader pattern that catches all variations:

```regex
/^#{1,4}\s*Slot\s*[\d:]+\s*[—\-].*/gm
```

This matches:
- `### Slot 1 — ...`
- `### Slot 02:30 — Wire Mesh`
- `## Slot 5:00 PM — ...`
- Any `#` heading starting with "Slot" followed by digits/colons and a dash

One line change in one file.

