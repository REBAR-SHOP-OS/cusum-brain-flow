
# Fix: Accounting Data Loads Only Once Per Day + Manual Refresh

## Problem

Every time the user navigates to the `/accounting` page, `loadAll()` fires -- hitting the mirror database and QuickBooks API. This is disruptive, slow, and wasteful when the user is just switching tabs or returning to the page within the same workday.

## Solution (Single file: `src/pages/AccountingWorkspace.tsx`)

### How It Works

1. **First visit of the day**: `loadAll()` fires automatically as it does now
2. **Subsequent visits same day**: Data is NOT reloaded (already in memory from the hook, and localStorage records the last load date)
3. **Manual Refresh button**: Always available, bypasses the daily check and calls `loadAll()` immediately
4. **Last refreshed indicator**: Show a small timestamp next to the Refresh button so the user knows when data was last loaded

### Technical Details

**New constants:**
```
const QB_LAST_LOAD_KEY = "qb-last-load-date";
```

**Modified `useEffect` in AccountingWorkspace:**
```typescript
useEffect(() => {
  if (!hasAccess) return;
  
  const today = new Date().toLocaleDateString("en-CA"); // "2026-02-17"
  const lastLoad = localStorage.getItem(QB_LAST_LOAD_KEY);
  
  if (lastLoad === today) {
    // Already loaded today -- skip auto-load
    // Still init web phone if needed
    if (webPhoneStatusRef.current === "idle") {
      webPhoneActionsRef.current.initialize();
    }
    return;
  }
  
  // First load of the day
  loadAllRef.current();
  localStorage.setItem(QB_LAST_LOAD_KEY, today);
  
  if (webPhoneStatusRef.current === "idle") {
    webPhoneActionsRef.current.initialize();
  }
}, [hasAccess]);
```

**Manual Refresh button update:**
- The existing Refresh button calls `qb.loadAll()` -- this stays unchanged
- After manual refresh completes, update `localStorage` timestamp
- Add a small "Last refreshed: 8:32 AM" label next to the button

**New state:**
- `lastRefreshTime: string | null` -- formatted time of last refresh, stored in localStorage alongside the date

**Guard:** If the hook's state is completely empty (e.g., user cleared browser data), force a load regardless of the daily check.

### What Does NOT Change

- The `useQuickBooksData` hook itself -- no changes
- The Refresh button -- still works on demand
- All other tabs, components, and data flow -- untouched
- Post-action reloads (after creating invoice, syncing, etc.) -- these still call `loadAll()` as they should

### Visual Change

The header refresh area changes from:
```
[Refresh All]
```
To:
```
Last updated: 8:32 AM    [Refresh All]
```

No new files, no new dependencies, no database changes.
