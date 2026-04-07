

# Fix Calendar Date Picker in Team Daily Report

## Problem
The calendar popover doesn't work because the Vizzy Brain panel overlay has `z-[100000]`, but the `PopoverContent` (rendered via Radix Portal at document body level) only has `z-50`. The calendar appears behind the overlay and is not clickable.

## Fix

### `src/components/vizzy/VizzyBrainPanel.tsx`
- Add `className="z-[100001]"` to the `PopoverContent` so it renders above the Brain panel overlay
- This ensures the calendar portal appears on top of the `z-[100000]` overlay

Single line change — add `z-[100001]` to the existing `PopoverContent` className:
```tsx
<PopoverContent className="w-auto p-0 z-[100001]" align="end">
```

No other files need changes.

