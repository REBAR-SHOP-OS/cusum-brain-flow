

# Fix: Make Activity Status Bar Visible and Match Odoo

## Problem Diagnosed
The activity status bar IS implemented and working correctly, but it appears invisible because:

1. **Data issue**: Most leads in columns like Prospecting, New, QC-Ben, Estimation-Ben, etc. have NO `expected_close_date` set, so they all show as "none" (grey status)
2. **Grey-on-grey**: The grey "none" segment color uses `hsl(var(--muted))` which is nearly identical to the bar's background color, making the bar invisible
3. **Bar is too thin**: At `h-1.5` (6px), it's much thinner than Odoo's bar which is about 4-6px tall and more prominent

## What Changes

### 1. Make the bar always visible (`PipelineColumn.tsx`)
- Increase bar height from `h-1.5` to `h-2` (8px) to match Odoo's thicker bar
- Change the "none" segment color to a more visible grey (e.g., `#d1d5db` / grey-300) so it contrasts with the muted background
- Ensure the bar always renders even when all leads have the same status (so users can still see the bar)

### 2. Make bar background darker for contrast
- Change the bar container background to a slightly darker shade so the grey segments are distinguishable

## Technical Details

### Color and size changes (`PipelineColumn.tsx`)

```typescript
// Make "none" segment visible against background
const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  planned: "#21b632",
  today: "#f0ad4e",
  overdue: "#d9534f",
  none: "#d1d5db",  // Changed from hsl(var(--muted)) to visible grey
};
```

Bar container: increase height and darken background:
```tsx
<div
  className="mt-1.5 h-2 w-full rounded-full overflow-hidden flex"
  style={{ backgroundColor: '#e5e7eb' }}  // slightly darker than segment grey
>
```

## Files Modified

| File | Change |
|---|---|
| `src/components/pipeline/PipelineColumn.tsx` | Increase bar height, fix "none" color contrast |

