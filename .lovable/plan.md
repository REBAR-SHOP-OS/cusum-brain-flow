

# Fix Scroll Issue in TranscribeView

## Problem
The main content area in `TranscribeView.tsx` doesn't scroll when transcript text is long. The outer container (`div.flex`) and the content area (`div.flex-1.p-4`) lack proper height constraints and overflow settings.

## Solution
Two changes in `src/components/office/TranscribeView.tsx`:

1. **Line 665** — Add `h-[calc(100vh-4rem)] overflow-hidden` to the root container so it has a fixed height boundary
2. **Line 718** — Change the content `div` to have `overflow-y-auto` so it becomes scrollable within that boundary

This ensures the content area scrolls independently while the speaker sidebar stays fixed.

