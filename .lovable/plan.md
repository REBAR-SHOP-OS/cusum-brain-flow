

# Fix: Super Admin Always Sees All Mobile Nav Items

## Problem
`sattar@rebar.shop` is a super admin but the `MobileNavV2` component doesn't check super admin status. The `isVisible` function only checks database roles and `allowedEmails` lists — it doesn't have a universal bypass for super admins. If the admin role hasn't loaded from the database yet (or was missing), items gated by `roles: ["admin"]` won't show.

## Solution
Import `useSuperAdmin` in `MobileNavV2` and add a super admin bypass at the top of the `isVisible` function. If the user is a super admin, **all items are visible** — no need to check roles, allowedEmails, or blockedEmails.

**File:** `src/components/layout/MobileNavV2.tsx`

1. Import `useSuperAdmin` from `@/hooks/useSuperAdmin`
2. Call `const { isSuperAdmin } = useSuperAdmin();` inside the component
3. Update `isVisible` to return `true` immediately if `isSuperAdmin`

```ts
const isVisible = (item) => {
  if (isSuperAdmin) return true;  // ← add this line
  // ... existing logic unchanged
};
```

This ensures `sattar@rebar.shop` and `radin@rebar.shop` always see every item (Accounting, CEO Portal, Admin, etc.) on mobile, regardless of what's in the database.

