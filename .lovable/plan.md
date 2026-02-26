

# Fix: Dashboard Content Blank + Scroll Issues

## Root Cause

The `SidebarProvider` component (from `src/components/ui/sidebar.tsx` line 119) renders its wrapper div with `min-h-svh` (100svh). This forces the accounting layout to be at least full viewport height, which overflows the `AppLayout`'s `<main className="flex-1 overflow-hidden">` container -- clipping all content.

The fix from the previous change (`min-h-screen` → `h-full`) was correct in intent but insufficient because `SidebarProvider`'s own wrapper still demands full viewport height.

## Fix

In `src/pages/AccountingWorkspace.tsx`, pass a `className` override to `SidebarProvider` to replace `min-h-svh` with `h-full`:

```tsx
<SidebarProvider defaultOpen={true} className="h-full !min-h-0">
```

This overrides the default `min-h-svh` so the entire accounting layout fits within its parent container, allowing proper scrolling inside the content area.

| File | Line | Change |
|---|---|---|
| `src/pages/AccountingWorkspace.tsx` | 303 | Add `className="h-full !min-h-0"` to `SidebarProvider` |

One-line change, no logic modifications.

