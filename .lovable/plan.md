

## Remove Description Text from Dashboard Cards

### Problem
The helper cards on `/home` display role descriptions (e.g., "Customer Support", "Estimating") below each card's name. Similarly, the shop floor cards show subtitle text. This clutters the UI, especially on tablets.

### Changes

**File: `src/pages/Home.tsx`**

1. **HelperCard component (line 339)**: Remove the `<p>` element that renders `helper.role`
2. **Shopfloor cards (lines 203-206)**: Remove the conditional block that renders `card.subtitle`

### Details

In the `HelperCard` component at the bottom of the file, the line:
```
<p className="text-[8px] sm:text-sm ...">{helper.role}</p>
```
will be removed entirely.

In the shopfloor workshop view, the block:
```
{card.subtitle && (
  <p className="text-[9px] ...">{card.subtitle}</p>
)}
```
will also be removed.

No backend changes needed. The `role` and `subtitle` properties remain in the data definitions for accessibility (`alt` text on helper images still uses `helper.role`).

