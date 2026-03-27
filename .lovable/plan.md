

# Unify Print and Office Tag — Single Component

## Problem
`RebarTagCard.tsx` (office) and `PrintTag` (in `PrintTags.tsx`) are duplicate components that drift apart whenever one is updated. Changes to the office card don't reflect in print and vice versa.

## Solution
Delete the `PrintTag` inline component from `PrintTags.tsx` and reuse the existing `RebarTagCard` component directly. The print route keeps its scoped CSS reset but renders `RebarTagCard` instead of `PrintTag`.

### Changes in `src/pages/PrintTags.tsx`

**1. Remove the entire `PrintTag` function** (lines 46-152) — it's now redundant.

**2. Remove duplicate helper functions** (lines 7-44) — `getWeight`, `fmtMmToFtIn`, `fmtVal`, `fmtDim`, `DIM_LEFT`, `DIM_RIGHT`, `DIM_COLS` are already in `RebarTagCard.tsx` or computed inline. Keep only `getWeight` and `DIM_COLS` (needed for row mapping).

**3. Import `RebarTagCard`** and render it instead of `PrintTag`:
```tsx
import { RebarTagCard } from "@/components/office/RebarTagCard";
```

**4. Update the render loop** (lines 257-276) to use `<RebarTagCard>` with the same props.

**5. Update scoped CSS** — change `.print-tag` selector to `.rebar-tag` (the class used by `RebarTagCard`).

### Export weight helper from RebarTagCard
Move `MASS_KG_PER_M` and `getWeight` into `RebarTagCard.tsx` as a named export so `PrintTags.tsx` can reuse it. Also export `DIM_COLS` (the combined dim keys array).

## Files Changed
- `src/components/office/RebarTagCard.tsx` — export `getWeight` and `DIM_COLS`
- `src/pages/PrintTags.tsx` — delete `PrintTag`, import and render `RebarTagCard`

