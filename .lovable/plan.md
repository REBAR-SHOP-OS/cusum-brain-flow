

## Fix: Auto-load accounting data on every page visit

### Problem
The accounting page only loads QuickBooks data once per calendar day. It stores the last load date in `localStorage` and skips loading if the date matches today. Additionally, a `useRef(hasLoadedToday)` flag prevents reloading even within the same session. This means:
- Revisiting the `/accounting` page later in the day shows stale or empty data
- Users must manually click "Refresh All" to see current data

### Solution
Remove the once-per-day guard so `loadAll()` is called every time the accounting page mounts (when the user has access). Keep the `hasLoadedToday` ref to prevent double-loading within the same component lifecycle (e.g., React strict mode), but allow it to fire on every fresh mount.

### Technical Details

**File:** `src/pages/AccountingWorkspace.tsx`

**Change:** Modify the `useEffect` (lines 194-210) to always call `loadAll()` on mount, removing the date-based skip logic:

```typescript
useEffect(() => {
  if (!hasAccess || hasLoadedToday.current) return;
  hasLoadedToday.current = true;

  loadAllRef.current();
  updateRefreshTimestamp();

  if (webPhoneStatusRef.current === "idle") {
    webPhoneActionsRef.current.initialize();
  }
}, [hasAccess]);
```

This removes the `localStorage` date check (`lastLoad !== today`) so data loads on every page visit. The `hasLoadedToday` ref still prevents duplicate loads within the same mount cycle. The refresh timestamp is updated so the UI shows when data was last loaded.

No other files need to change.

