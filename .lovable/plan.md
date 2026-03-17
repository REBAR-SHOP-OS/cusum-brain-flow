

## Plan: Add Final Confirm Icon in Header Area

### Problem
The "Confirm & Save" button is hidden at the bottom of the list. The user wants a prominent confirm icon near the top header — visible at all times — that finalizes the entire list for a specific date so it appears in **RECENTS**.

### Changes

**File: `src/components/purchasing/PurchasingListPanel.tsx`**

1. Add a **CheckCircle** icon button next to the Calendar button in the header (line 69-97 area)
2. This button will:
   - If no date is selected → open calendar popover automatically and show toast "Select a date first"
   - If date is selected → open the existing `ConfirmActionDialog` to confirm & save
3. Style: green primary color, slightly larger, with a tooltip "Confirm & Save List"
4. Keep the existing bottom "Confirm & Save" button as well for redundancy

The confirm logic already exists (`confirmList` from `usePurchasingList`) — this just adds a more visible trigger in the header.

