

# Fix: Add User Dialog Hidden Behind Vizzy Brain Panel

## Problem
Clicking the UserPlus icon makes the screen go black but the dialog is invisible. The Vizzy Brain panel renders at `z-[100000]`, but the `AddUserDialog` uses standard `shadcn/ui` `Dialog` which defaults to ~z-50. The overlay darkens the screen while the dialog content is hidden behind the panel.

## Fix

### File: `src/components/vizzy/AddUserDialog.tsx`

Replace the standard `DialogContent` with `DialogPortal` + explicit high z-index layering, matching the pattern used by all other dialogs in VizzyBrainPanel:

```tsx
import { DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Replace:
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-md">
    ...
  </DialogContent>
</Dialog>

// With:
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogPortal>
    <DialogOverlay className="z-[100001]" />
    <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100002] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out ... sm:rounded-lg">
      {/* Same inner content: DialogHeader, form fields, DialogFooter */}
      {/* Add manual close button (X) in top-right */}
    </DialogPrimitive.Content>
  </DialogPortal>
</Dialog>
```

This is the exact same pattern used by the Activity Report Dialog, Time Clock Dialog, and Overview Dialog in the same panel. Single file change, no logic changes.

