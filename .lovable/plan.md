

## Plan: Fix Zero Rendering on Tags — Use Sans-Serif with Tabular Nums

### Problem
Source Code Pro (and most monospace coding fonts) renders `0` with a dot inside. The existing shop floor typography memory already solved this: use `font-sans tabular-nums` (Inter) which gives clean zeros with fixed-width digit alignment.

### Root Cause
`RebarTagCard` and `PrintTags` use `font-mono`, which maps to Source Code Pro — a coding font with a dotted zero by design.

### Solution
Switch the tag typography from `font-mono` to `font-sans` with `tabular-nums` style, matching the shop floor standard already documented in memory. Inter renders a clean, empty zero that is naturally distinguishable from 8 by shape alone.

### Changes

| File | Change |
|------|--------|
| `src/components/office/RebarTagCard.tsx` | Replace `font-mono` with `font-sans` and add `tabular-nums` style on the tag container |
| `src/pages/PrintTags.tsx` | Update print CSS `font-family` from `'Source Code Pro'` to `'Inter', system-ui, sans-serif` and add `font-variant-numeric: tabular-nums` |

### What does NOT change
- Tag layout, sizing, borders, colors — untouched
- No database or logic changes
- Shop floor components — already correct
- Can remove Source Code Pro font imports from `index.html` and `src/index.css` since tags were the only consumer

