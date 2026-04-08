

# Fix: Report Dialog Hidden Behind Vizzy Brain Panel

## Root Cause

The Vizzy Brain panel renders at `z-[100000]`. The `SectionDetailReportDialog` uses the standard Radix `Dialog` component which renders its overlay and content at `z-50`. Since `z-50 < z-100000`, the dialog's black overlay appears behind the Brain panel (making the background go dark) while the dialog content is invisible — trapped underneath.

## Fix

**File: `src/components/vizzy/SectionDetailReport.tsx`** (lines 631)

Add a z-index override to the `DialogContent` so it renders above the Brain panel:

```tsx
<DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col z-[100002]">
```

Also need to ensure the overlay is above too. Since Radix Dialog portal renders overlay + content as siblings, we need to add a custom overlay or use the `DialogOverlay` with a high z-index. The simplest approach: wrap with a portal-level style.

Two changes in `SectionDetailReport.tsx`:

1. Import `DialogOverlay` from the dialog component
2. Add explicit `DialogOverlay` with `z-[100001]` and set `DialogContent` to `z-[100002]`

Alternatively, the cleanest fix: add a `className` prop to `DialogContent` with `z-[100002]` — but Radix renders the overlay separately. So we need to also add a custom `DialogOverlay`.

**Change in `src/components/vizzy/SectionDetailReport.tsx`:**

```tsx
// Line 2: Add DialogOverlay to imports
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogOverlay,
} from "@/components/ui/dialog";

// Lines 631: Add overlay and update content z-index
<Dialog>
  <DialogTrigger asChild>
    ...
  </DialogTrigger>
  <DialogOverlay className="z-[100001]" />
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col z-[100002]">
    ...
  </DialogContent>
</Dialog>
```

We also need to verify `DialogOverlay` is exported from `src/components/ui/dialog.tsx`. If not, we add the export.

**File: `src/components/ui/dialog.tsx`** — Verify `DialogOverlay` is exported (it likely is since it's a standard shadcn component, but we'll confirm and ensure it accepts className).

## Result
- Report dialogs will render above the Vizzy Brain panel
- No more black screen behind the panel
- Reports will be fully visible and functional

