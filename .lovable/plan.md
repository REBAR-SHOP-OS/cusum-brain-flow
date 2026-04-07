

# Add Icons to Station Action Buttons

## Problem
The "Record Stroke" button on the cutter station page has a large empty area on the right side. While the left side has a Scissors icon, the button could benefit from a more prominent action indicator. The user wants clearer visual cues on start/stop action buttons.

## Analysis
After auditing all station buttons:
- **CutEngine**: `LOCK & START` has Lock icon ✓, `ABORT` has XCircle ✓, `Stop Run` has XCircle ✓
- **SlotTracker**: `Record Stroke` has Scissors icon (left only), `Stop` has StopCircle ✓, `Complete` has CheckCircle2 ✓
- **BenderStationView**: Done button has CheckCircle2 ✓

The "Record Stroke" button is the main action button operators tap repeatedly — it spans the full width but only has a small icon on the left, making the right half feel empty.

## Changes

### `src/components/shopfloor/SlotTracker.tsx`
Add a right-side icon to the Record Stroke button to fill the empty space and provide visual balance:
- Add a `ChevronRight` or `Zap` icon on the right side of the "Record Stroke" button text to indicate action/progress
- This makes the button feel more complete and actionable

```text
BEFORE: [✂ Record Stroke (1/8) — 2 pcs                    ]
AFTER:  [✂ Record Stroke (1/8) — 2 pcs                  ⚡]
```

Single file, single line change.

