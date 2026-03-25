

## Auto-Download PDF After Confirm & Save

### What the User Wants
When the user marks items as purchased (green checkmarks), selects a date, and hits "Confirm & Save", the PDF should automatically download immediately — no need to navigate to the confirmed view and manually click download.

### Current Behavior
- Checkmark icon works correctly (toggles purchase state)
- X icon already appears next to purchased items to undo
- After confirm, the list saves a snapshot but does NOT auto-generate the PDF
- PDF can only be downloaded manually from the `PurchasingConfirmedView`

### Changes

**File: `src/components/purchasing/PurchasingListPanel.tsx`**

1. Import and reuse the `generatePdf` function (extract it to a shared utility or import from `PurchasingConfirmedView`)
2. After `confirmList(dateStr)` succeeds in the `onConfirm` handler, immediately call `generatePdf` with the confirmed data to auto-download the shopping list PDF

**File: `src/components/purchasing/PurchasingConfirmedView.tsx`**

1. Export the `generatePdf` function so it can be reused

**File: `src/hooks/usePurchasingList.ts`**

1. Update `confirmList` to return the snapshot data and confirmed record info so the caller can pass it to `generatePdf`

### Implementation Flow

```text
User clicks "Confirm & Save"
  → confirmList(dateStr) saves snapshot to DB and returns snapshot data
  → generatePdf() is called immediately with the returned data
  → PDF auto-downloads in browser
  → Dialog closes
```

| File | Change |
|---|---|
| `src/components/purchasing/PurchasingConfirmedView.tsx` | Export `generatePdf` function |
| `src/hooks/usePurchasingList.ts` | Return snapshot data from `confirmList` |
| `src/components/purchasing/PurchasingListPanel.tsx` | Call `generatePdf` after successful confirm |

