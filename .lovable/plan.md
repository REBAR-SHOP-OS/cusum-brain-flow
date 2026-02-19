
# Fix: Office Details Form Overflowing Right Edge

## Scope
Single file: `src/components/office/AIExtractView.tsx`
No database changes. No other files touched.

## Problem Analysis

Three spots in `AIExtractView.tsx` cause content to extend beyond the visible screen on a 10" tablet:

### 1. Root container (line 551)
```tsx
<div className="p-6 space-y-6 max-w-[95vw] mx-auto">
```
`max-w-[95vw]` is a viewport-relative max-width but does not prevent inner flex children from overflowing the `ScrollArea`. The div needs `w-full min-w-0 overflow-hidden` to actually constrain children.

### 2. Header row (line 553)
```tsx
<div className="flex items-center justify-between">
```
The right side of this row contains three things inline: a History button, a "+ New" button, and a Delivery/Pickup toggle button group. On a tablet with a sidebar, these ~280px of buttons can push the row past the container edge.

**Fix**: Add `flex-wrap gap-y-2` so the right group drops to a new line when needed.

### 3. Pipeline status steps (line 639)
```tsx
<div className="flex items-center gap-1">
  {/* 6 labeled steps + 5 arrows */}
```
Six labeled pills (`Uploaded → Extracting → Extracted → Mapped → Validated → Approved`) plus five arrow icons at `px-3` padding each = roughly 500+ px. On a tablet this wraps or overflows.

**Fix**: Add `flex-wrap gap-y-1` so steps wrap to a second line gracefully instead of pushing past the edge.

## Changes (surgical — one file only)

### Change 1 — Root container div (line 551)
```diff
- <div className="p-6 space-y-6 max-w-[95vw] mx-auto">
+ <div className="p-6 space-y-6 w-full max-w-full overflow-hidden">
```

### Change 2 — Header flex row (line 553)
```diff
- <div className="flex items-center justify-between">
+ <div className="flex flex-wrap items-center justify-between gap-y-2">
```

### Change 3 — Pipeline steps row (line 639)
```diff
- <div className="flex items-center gap-1">
+ <div className="flex flex-wrap items-center gap-1">
```

## No other changes
- No other files modified
- No database changes
- No UI logic, component structure, or styling outside these three lines is altered
