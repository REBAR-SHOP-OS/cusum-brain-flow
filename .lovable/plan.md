

# Remove Horizontal Scroll — Show All Users in One Line

## Problem
The user tab bar currently uses `overflow-x-auto` which creates a horizontal scrollbar. The user wants **no scrollbar at all** — all users must be visible in a single row, even if it means making the entire Vizzy Brain modal wider.

## Changes

### 1. Widen the modal container (line 1025)
Change `max-w-5xl` to `max-w-7xl` to give more horizontal space for all user tabs.

### 2. Remove scroll from user tab bar (line 1055)
Replace `overflow-x-auto scrollbar-none` with `flex-wrap` so tabs wrap naturally if needed, but with the wider container they should all fit in one line.

Alternatively, keep `overflow-visible` and `whitespace-nowrap` to force a single line — combined with the wider modal, all users will be visible without scroll.

| File | Line | Change |
|------|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | 1025 | `max-w-5xl` → `max-w-7xl` |
| `src/components/vizzy/VizzyBrainPanel.tsx` | 1055 | Remove `overflow-x-auto scrollbar-none`, add `flex-wrap` |

