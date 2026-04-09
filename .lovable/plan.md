

# Fix: Double "X" Close Icon in Sales Lead Drawer

## Root Cause

Two close buttons are rendered simultaneously:

1. **`SheetContent`** in `src/components/ui/sheet.tsx` (line 60) — the `shadcn/ui` Sheet component automatically appends a `<SheetPrimitive.Close>` with an `<X />` icon at `absolute right-4 top-4` inside every `SheetContent`.

2. **`SalesLeadDrawer`** in `src/components/sales/SalesLeadDrawer.tsx` (line 89-91) — a manual `<Button>` with `<X />` is rendered in the drawer header.

Both icons land in the top-right corner, creating the overlapping double-X visible in the screenshot.

## Fix

### File: `src/components/sales/SalesLeadDrawer.tsx` (lines 88-92)

Remove the manually rendered close button since `SheetContent` already provides one:

```tsx
// Remove this block:
<div className="flex items-center gap-1 shrink-0">
  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onClose()}>
    <X className="w-3.5 h-3.5" />
  </Button>
</div>
```

The built-in `SheetPrimitive.Close` in `SheetContent` already calls `onOpenChange(false)` which triggers `onClose()` via the Sheet's `onOpenChange` prop on line 78.

### Result
Single close button in the top-right corner, no visual overlap.

### Single deletion in one file. No database or logic changes.

