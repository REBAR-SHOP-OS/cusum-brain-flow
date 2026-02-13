
# Restrict CEO Portal to Super Admin Only

## What Changes

The CEO Portal (`/ceo`) currently allows any user with the `admin` role to access it. This change restricts it to only the super admin (`sattar@rebar.shop`).

## Technical Details

### File: `src/pages/CEOPortal.tsx`

- Replace `useUserRole` with `useSuperAdmin` hook (which already checks for `sattar@rebar.shop`)
- Change the guard from `!isAdmin` to `!isSuperAdmin`
- Update the access denied message from "Only administrators" to "Only the super admin"

### Before
```typescript
const { isAdmin, isLoading } = useUserRole();
if (!isAdmin) { /* block */ }
```

### After
```typescript
const { isSuperAdmin } = useSuperAdmin();
if (!isSuperAdmin) { /* block */ }
```

No database changes required. The `useSuperAdmin` hook already exists and checks the email against `sattar@rebar.shop`.
