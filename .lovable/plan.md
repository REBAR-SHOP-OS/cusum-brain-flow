

# Fix: Edit Subtitle Dialog Opens Only on Double-Click

## Problem
The "Edit Subtitle Text" dialog opens on every single click (`onClick`) on the blue/violet text track bar — including after drag operations. This is disruptive when the user just wants to move the text overlay.

## Solution

### `src/components/ad-director/editor/TimelineBar.tsx` — line 891

Change:
```tsx
onClick={(e) => { e.stopPropagation(); onEditOverlay?.(ov); }}
```
To:
```tsx
onDoubleClick={(e) => { e.stopPropagation(); onEditOverlay?.(ov); }}
```

Single change, one line. The dialog will only appear on double-click; dragging and single clicks will no longer trigger it.

