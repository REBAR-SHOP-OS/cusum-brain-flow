

# Add Stop Run Icon Beside Record Stroke Button

## Analysis
The screenshot shows the "Record Stroke" button with the red-circled area on the right side (the Zap icon area). The user wants a **Stop** icon button placed next to it.

Looking at the code in `SlotTracker.tsx`, there's already a "Stop" button (lines 357-366) but it only appears when `totalCutsDone > 0`. The user wants a persistent stop icon **beside** the Record Stroke button (inside the same row), not conditionally hidden.

## Change

### `src/components/shopfloor/SlotTracker.tsx`

**Add a Stop Run icon button** right after the Record Stroke button (line 353), visible whenever the Record Stroke button is visible and `canWrite` is true. This will call `onCompleteRun` (same handler as the existing stop button).

```tsx
{/* Record stroke */}
{activeSlots.length > 0 && canWrite && (
  <Button
    className="flex-1 gap-2 font-bold h-12 text-base justify-between px-4"
    onClick={onRecordStroke}
  >
    <span className="flex items-center gap-2">
      <Scissors className="w-5 h-5" />
      Record Stroke ({nextStroke}/{maxStrokes}) — {piecesPerStroke} pcs
    </span>
    <Zap className="w-5 h-5" />
  </Button>
)}

{/* NEW: Stop Run button beside Record Stroke */}
{activeSlots.length > 0 && canWrite && !allDone && (
  <Button
    variant="destructive"
    className="h-12 px-3"
    onClick={onCompleteRun}
    title="Stop"
  >
    <StopCircle className="w-5 h-5" />
  </Button>
)}
```

`StopCircle` is already imported. No new dependencies needed. The existing conditional stop button (lines 357-366) that shows piece count can remain as-is for when pieces have been cut.

| File | Change |
|------|--------|
| `src/components/shopfloor/SlotTracker.tsx` | Add Stop icon button next to Record Stroke |

