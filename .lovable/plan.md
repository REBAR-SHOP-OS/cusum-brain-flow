
# Remove "Slip Number" Display from Deliveries Page — Slips Tab

## What Was Found

After navigating to `/deliveries` and switching to the **Slips** tab, I can see the issue clearly. Each packing slip card currently displays:

- **Row 1:** `[📄 icon] PS-MLTV5F3Z` — this is the Slip Number
- **Row 2:** `EARNSCLIFFE CRICKET AIR DOME • Feb 19, 2026` — customer name and date

The "Slip Number" (e.g., `PS-MLTV5F3Z`) is rendered in `src/pages/Deliveries.tsx` at lines 381–384 inside the Slips tab card layout.

## Scope

**Single file, single block removal:**

| File | Change |
|------|--------|
| `src/pages/Deliveries.tsx` | Remove the `<span>` containing the file icon and `{slip.slip_number}` from the slip card header |

No other files, no database, no other tabs, no other components are touched.

## The Fix

**File:** `src/pages/Deliveries.tsx`  
**Location:** Lines 381–384

**Before:**
```tsx
<span className="font-medium flex items-center gap-2">
  <FileText className="w-4 h-4" />
  {slip.slip_number}
</span>
```

**After** — the entire `<span>` is removed. The card header `<div>` (line 380) will continue to hold the badge and delete button on the right side.

## What Is NOT Changed

- Today, Upcoming, All tabs — untouched
- Delivery cards layout — untouched
- Slip card click behavior (opening the packing slip view) — untouched
- `draft` badge — untouched
- Delete (trash) button — untouched
- Customer name and date on the second row — untouched
- Database, API, queries — untouched
- All other pages and components — untouched
