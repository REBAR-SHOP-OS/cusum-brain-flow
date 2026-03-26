

# Group Ratio & Duration into Popover Categories

## What
Move the RATIO and DURATION controls from inline toggle buttons into popover dropdowns, matching the same pattern as the existing Style and Products popovers. This creates a cleaner, more consistent bottom bar.

## Change in `src/components/ad-director/ChatPromptBar.tsx`

**Replace** the inline Ratio buttons (lines 210-227) with a Popover that shows the ratio options on click, displaying a button like `📐 Ratio 16:9 ▾`.

**Replace** the inline Duration buttons (lines 232-249) with a Popover that shows the duration options on click, displaying a button like `⏱ Duration 15s ▾`.

Both will use the same visual pattern as Style/Products popovers:
- Rounded pill button with icon + label + selected value
- Active state highlights when non-default
- Popover opens on click with the options grid

### Layout after change
```text
[ 📐 16:9 ▾ ] [ ⏱ 15s ▾ ] [ 🎨 Style ▾ ] [ # Products ▾ ]  [Send]
```

Each popover shows its options in a small grid when clicked, keeping the bottom bar compact and consistent.

| File | Change |
|---|---|
| `src/components/ad-director/ChatPromptBar.tsx` | Convert Ratio and Duration inline buttons to Popover dropdowns matching Style/Products pattern |

