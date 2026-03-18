

## Plan: Fix Confirm Icon — Remove Calendar Dependency, Make It Bolder

### Problem
The confirm (checkmark) icon currently requires a date to be selected via calendar first. User says it should ONLY confirm/save the current list to RECENTS — the calendar is a separate button next to it. Also, the icon needs to be bigger and bolder.

### Changes — `src/components/purchasing/PurchasingListPanel.tsx`

**1. Remove calendar dependency from confirm button**
- Remove the `if (!filterDate)` check that opens the calendar
- Instead, use `filterDate ?? new Date()` — if no date is selected, default to today
- This way clicking confirm always works: saves with the selected date or today

**2. Make the icon bigger and more prominent**
- Increase button size from `h-9 w-9` to `h-11 w-11`
- Increase icon size from `w-5 h-5` to `w-7 h-7`
- Make the green color bolder: `text-green-500` with stronger hover effect
- Add a subtle border or background to make it stand out more

### Single file change
- `src/components/purchasing/PurchasingListPanel.tsx` — lines 80-94

