

# Admin-Only Delete & Safer Placement in Lead Detail Drawer

## Problem
The delete button (trash icon) sits right next to the edit button in the drawer header. Any user can accidentally (or intentionally) delete leads. The screenshot shows this circled as a concern -- delete should be admin-only and moved to a less dangerous location.

## Changes

### File: `src/components/pipeline/LeadDetailDrawer.tsx`

**1. Import `useUserRole` hook**
Add `import { useUserRole } from "@/hooks/useUserRole"` to check admin status.

**2. Remove delete button from header**
The header currently has edit (pencil) and delete (trash) side by side. Remove the trash button entirely from the header area. Keep only the pencil (edit) button there.

**3. Add admin-only delete at the bottom of the drawer**
Move the delete action to the **footer** of the drawer, visible only to admins. It will be styled as a subtle destructive text button (e.g., "Delete Lead") placed in the footer bar alongside the created/updated timestamps. This makes it:
- Hard to hit accidentally (far from primary actions)
- Admin-gated (non-admins never see it)
- Still accessible when genuinely needed

### Layout After Change

**Header (top-right):**
```
[Pencil/Edit]  [X close]
```

**Footer (bottom):**
```
Created Feb 10, 2026          [Delete Lead]  (admin only)          Updated 2h ago
```

The "Delete Lead" button uses `text-destructive` styling with a small trash icon, requiring a confirmation dialog before executing.

### Technical Detail

- `useUserRole()` is called inside the component to get `isAdmin`
- The delete button is conditionally rendered: `{isAdmin && ( ... )}`
- Role check uses the existing `user_roles` table via the established hook -- no client-side shortcuts
- No other behavioral changes; edit, stage change, and all tabs remain unchanged
