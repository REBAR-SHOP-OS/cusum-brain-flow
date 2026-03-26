

# Fix Toast Pointer-Events Passthrough

## Problem
Both the shadcn `Toaster` (radix) and `Sonner` toaster are rendered in `App.tsx`. The Sonner container uses `pointer-events: none` on its wrapper so it doesn't block the page, but individual toast elements don't reliably get `pointer-events: auto`, causing visible toasts to be click-through "ghosts" that let users accidentally trigger buttons behind them.

## Fix

### `src/components/ui/sonner.tsx`
Add `pointer-events: auto` to the individual toast className so each toast element is always interactive:

```tsx
toast:
  "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:pointer-events-auto",
```

### `src/components/ui/toast.tsx`
Add `pointer-events-auto` to the `toastVariants` base class so the radix-based toasts are also always interactive:

Current base: `"group pointer-events-auto relative flex ..."`
This already has it — verify it's present. If not, add it.

### Validation
Both toaster systems will have `pointer-events: auto` on each toast element, ensuring they block clicks to elements behind them while visible.

| File | Change |
|---|---|
| `src/components/ui/sonner.tsx` | Add `pointer-events-auto` to toast classNames |
| `src/components/ui/toast.tsx` | Verify `pointer-events-auto` is present in `toastVariants` base |

