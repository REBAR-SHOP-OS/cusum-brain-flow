

# Add Unique Colors to Kanban Columns

## Overview
Assign a distinct color to each employee's Kanban column header so users can visually distinguish columns at a glance.

## Scope
Only `src/pages/Tasks.tsx` -- no other files change.

## Implementation

### Color Palette
Define an array of visually distinct colors (as Tailwind border-top / header background classes):

```text
COLUMN_COLORS = [
  "border-t-blue-500 bg-blue-500/10",
  "border-t-purple-500 bg-purple-500/10",
  "border-t-emerald-500 bg-emerald-500/10",
  "border-t-orange-500 bg-orange-500/10",
  "border-t-pink-500 bg-pink-500/10",
  "border-t-teal-500 bg-teal-500/10",
  "border-t-yellow-500 bg-yellow-500/10",
  "border-t-red-500 bg-red-500/10",
  "border-t-indigo-500 bg-indigo-500/10",
  "border-t-cyan-500 bg-cyan-500/10",
]
```

### Assignment
Each employee gets a color based on their index in the sorted employees array: `COLUMN_COLORS[index % COLUMN_COLORS.length]`.

### Visual Changes
- Column container: gets a thick colored top border (`border-t-4`)
- Column header area: gets a subtle tinted background matching the color
- The rest of the column body remains unchanged

### What Changes in Code
1. Add `COLUMN_COLORS` constant array (line ~62 area)
2. In the `.map()` rendering columns (line ~340), use the index to apply `COLUMN_COLORS[index]` to the column wrapper div's className (adding `border-t-4` and the color class) and to the header div's className (adding the bg tint)

## Files Modified
1. `src/pages/Tasks.tsx` only
