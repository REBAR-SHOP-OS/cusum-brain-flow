

# Fix: Dashboard Content Not Visible (Fit-to-Page)

## Root Cause

The `AppLayout` wraps page content in:
```
<main className="flex-1 overflow-hidden">
```

The `AccountingWorkspace` then renders:
```
<div className="flex min-h-screen w-full">
```

`min-h-screen` (100vh) exceeds the actual available space inside `main` (which is viewport minus TopBar minus any other chrome). Combined with `overflow-hidden` on the parent, the dashboard content renders below the visible area or gets clipped to zero height.

## Fix

Change `min-h-screen` to `h-full` on the outer wrapper in `AccountingWorkspace.tsx` so the layout fills exactly the available space from its parent rather than demanding full viewport height.

| File | Change |
|---|---|
| `src/pages/AccountingWorkspace.tsx` (line 304) | `min-h-screen` → `h-full` |

This is a one-line CSS class change. No logic or component changes needed.

