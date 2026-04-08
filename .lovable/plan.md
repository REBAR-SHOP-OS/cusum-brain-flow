

# Adjust Tag Card Section Heights

## Problem
The shape image section (#1) takes too much vertical space, while the metadata section (#2, Item/Ref/Customer/Remark) is too compressed.

## Changes

**File: `src/components/office/RebarTagCard.tsx`**

1. **Shape image section (line 138)**: Change from `flex-1` to a fixed/smaller height — replace `className="flex-1 min-h-0 ..."` with a max-height constraint like `style={{ height: "35%" }}` or `className="shrink min-h-0"` with a reduced flex basis
2. **Metadata section (line 159)**: Increase `min-h-[3.5rem]` to `min-h-[5rem]` and give it `flex-1` so it takes remaining space

Specifically:
- Line 138: Change `flex-1 min-h-0` → `min-h-0` with `style={{ flex: "1 1 30%" }}` (shrink shape area)
- Line 159: Change `min-h-[3.5rem]` → `flex-1 min-h-[3rem]` (expand metadata area)

This redistributes vertical space: less for shape image, more for the Item/Ref/Customer/Remark block.

