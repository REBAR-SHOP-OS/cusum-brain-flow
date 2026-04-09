
# Fix: Add User Dialog Still Closes When Clicking the Email Field

## Root Cause
The problem is not the input itself anymore.

`AddUserDialog` is rendered through a portal, but in React, click events from portal content still bubble through the React component tree. Since `VizzyBrainPanel` has this backdrop wrapper:

```tsx
<motion.div ... onClick={onClose}>
```

any click inside the Add User dialog can still reach that handler and close the whole panel. That is why the dialog still disappears when the user interacts with the email field.

## Fix
Update the Vizzy Brain backdrop so it only closes when the user clicks the actual dark background, not any descendant or portal-based dialog.

### File
`src/components/vizzy/VizzyBrainPanel.tsx`

### Change
Replace:

```tsx
onClick={onClose}
```

with:

```tsx
onClick={(e) => {
  if (e.target === e.currentTarget) onClose();
}}
```

## Why This Works
- Clicking the dark backdrop closes the panel as before
- Clicking inside the main Vizzy panel does not close it
- Clicking inside `AddUserDialog` no longer bubbles into a forced close
- This is the correct fix for dialogs rendered via portal inside a clickable overlay parent

## Optional Hardening
Keep the existing protections in `AddUserDialog.tsx`:
- `onInteractOutside={(e) => e.preventDefault()}`
- `onPointerDownOutside={(e) => e.preventDefault()}`

Those are still useful for Radix behavior, but the real bug is the parent backdrop click handler in `VizzyBrainPanel`.

## Scope
- 1 file change required for the actual fix
- no database changes
- no permission logic changes
- minimal, safe UI fix
