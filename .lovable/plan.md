

# Make the Red Stop Button Bigger with "STOP" Label

## Current State
The red stop button next to "Record Stroke" (line 358-365 in `SlotTracker.tsx`) is a small square button with only a `StopCircle` icon (`w-5 h-5`, `h-12 px-3`).

## Change

### File: `src/components/shopfloor/SlotTracker.tsx` (lines 358-365)

Make the button larger and add "STOP" text:

```tsx
// From:
<Button variant="destructive" className="h-12 px-3" onClick={onCompleteRun} title="Stop">
  <StopCircle className="w-5 h-5" />
</Button>

// To:
<Button variant="destructive" className="h-16 w-20 px-3 flex flex-col items-center gap-1" onClick={onCompleteRun} title="Stop">
  <StopCircle className="w-8 h-8" />
  <span className="text-xs font-bold tracking-wide">STOP</span>
</Button>
```

- Icon: `w-5 h-5` → `w-8 h-8`
- Button: `h-12` → `h-16 w-20`, flex column layout
- Added "STOP" text label below the icon

Single line change in one file. No database or logic changes.

