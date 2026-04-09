

# Fix: Add User Dialog Closes When Typing Email

## Problem
When the user clicks on the email input field inside the Add User dialog, the dialog closes immediately. The screen "jumps out" — the dialog disappears.

## Root Cause
The `DialogPrimitive.Content` used in `AddUserDialog.tsx` lacks `onInteractOutside` and `onPointerDownOutside` event handlers. Radix Dialog treats certain pointer events as "outside interaction" and calls `onOpenChange(false)`. Because the dialog is rendered inside a high-z-index Vizzy Brain panel with complex layering, Radix's focus/interaction detection may misidentify clicks on the input as outside the dialog content.

## Fix

### File: `src/components/vizzy/AddUserDialog.tsx` (line 87-88)

Add `onInteractOutside` and `onPointerDownOutside` handlers to `DialogPrimitive.Content` to prevent the dialog from closing when interacting with elements inside it:

```tsx
<DialogPrimitive.Content
  onInteractOutside={(e) => e.preventDefault()}
  onPointerDownOutside={(e) => e.preventDefault()}
  className="fixed left-[50%] top-[50%] z-[100002] ..."
>
```

This stops Radix from interpreting clicks inside the dialog (on the input, buttons, etc.) as "outside" interactions. The user can still close the dialog via Cancel, the X button, or pressing Escape.

Single two-line addition in one file. No logic or database changes.

