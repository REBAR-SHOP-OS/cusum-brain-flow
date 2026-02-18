

# Decouple Chat Refresh from QuickBooks Sync

## Problem
In `src/pages/AccountingWorkspace.tsx`, lines 191-205, the daily-load `useEffect` calls `updateRefreshTimestamp()` (line 199) and includes it in the dependency array (line 205). This causes the global refresh timestamp to update whenever QB loads, which triggers Chat and other modules to unnecessarily refresh.

## Change (single file: `src/pages/AccountingWorkspace.tsx`)

### Before (lines 191-205):
```typescript
useEffect(() => {
  if (!hasAccess) return;
  const today = new Date().toLocaleDateString("en-CA");
  const lastLoad = localStorage.getItem(QB_LAST_LOAD_KEY);
  if (lastLoad !== today) {
    loadAllRef.current();
    updateRefreshTimestamp();  // <-- PROBLEM: triggers chat refresh
  }
  if (webPhoneStatusRef.current === "idle") {
    webPhoneActionsRef.current.initialize();
  }
}, [hasAccess, updateRefreshTimestamp]);  // <-- PROBLEM: extra dependency
```

### After:
```typescript
useEffect(() => {
  if (!hasAccess || hasLoadedToday.current) return;
  const today = new Date().toLocaleDateString("en-CA");
  const lastLoad = localStorage.getItem(QB_LAST_LOAD_KEY);
  if (lastLoad !== today) {
    loadAllRef.current();
    // updateRefreshTimestamp removed — prevents chat refresh coupling
  }
  hasLoadedToday.current = true;
  if (webPhoneStatusRef.current === "idle") {
    webPhoneActionsRef.current.initialize();
  }
}, [hasAccess]);
```

### What changes:
1. **Remove** `updateRefreshTimestamp()` call (line 199)
2. **Remove** `updateRefreshTimestamp` from dependency array (line 205) -- only `[hasAccess]` remains
3. **Add** `hasLoadedToday.current` guard at the top and set it to `true` after the block -- adds an extra layer of once-per-session protection (in addition to the localStorage date check)

### Why this fixes it:
`updateRefreshTimestamp` updates a shared state/timestamp that other components (including Chat) subscribe to. By removing it from this effect, QB's daily auto-load no longer signals a global refresh. Manual refresh (`handleManualRefresh` on line 186) still calls `updateRefreshTimestamp`, which is correct -- users explicitly clicking refresh should update the timestamp.

### What stays the same:
- Once-per-day QB load logic (localStorage `QB_LAST_LOAD_KEY`)
- WebPhone initialization
- Manual refresh behavior
- All other files untouched

