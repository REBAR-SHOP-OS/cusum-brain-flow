

# Auto-Sync Pipeline on Every Page Open

## Problem
Users must manually click the Sync button when opening the Pipeline. The user wants an automatic Odoo sync to fire every time the pipeline page is opened.

## Solution
Add a `useEffect` that triggers `handleOdooSync()` once on component mount. Use a `useRef` flag to ensure it only fires once per mount (not on re-renders), and skip if a sync is already in progress.

## Changes

### `src/pages/Pipeline.tsx`
- Add a `useEffect` after `handleOdooSync` is defined (~line 678) that calls it on mount
- Use a `hasAutoSynced` ref to prevent double-firing in StrictMode
- Guard: skip if `isSyncingOdoo` is already true

```text
const hasAutoSynced = useRef(false);
useEffect(() => {
  if (!hasAutoSynced.current && !isSyncingOdoo) {
    hasAutoSynced.current = true;
    handleOdooSync();
  }
}, []);
```

This ensures every time a user navigates to `/pipeline`, a fresh Odoo sync starts immediately — no cooldown, no manual button press needed.

| File | Change |
|---|---|
| `Pipeline.tsx` | Add mount-triggered auto-sync via useEffect + ref guard |

