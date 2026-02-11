

## Fix: Hide Inbox and Other Pages from External Users

### The Problem

External users (non-`@rebar.shop` emails) can see the Inbox and other restricted pages because of a logic ordering bug in `RoleGuard`.

**Line 55** checks `roles.length === 0` and returns children (pass-through) immediately. Since external users typically have no roles in the `user_roles` table, this early return fires **before** the external user routing logic on line 58 ever runs.

### The Fix

**File: `src/components/auth/RoleGuard.tsx`**

Move the external user check (lines 57-76) **above** the `roles.length === 0` early return (line 55). This ensures external users are always routed correctly regardless of whether they have roles assigned.

**Before (broken order):**
```text
1. if roles empty -> pass through (BUG: external users escape here)
2. if external user -> restrict to Clock/Team/HR (never reached)
3. role-based checks for internal users
```

**After (correct order):**
```text
1. if external user -> restrict to Clock/Team/HR (always enforced)
2. if roles still loading -> pass through
3. role-based checks for internal users
```

### Technical Details

Restructure the guard logic in `RoleGuard.tsx`:

- Move the `isInternal` check and external routing block before the `isLoading || roles.length === 0` check
- Keep the `isLoading` early return for internal users only (they need roles to determine access)
- Remove `roles.length === 0` from the early return since it was masking the bug

No other files are changed. No database or backend changes needed.

