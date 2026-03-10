

# Fix: manage-machine Edge Function Returning Non-2xx

## Root Cause

**Primary:** The `manage-machine` edge function uses the **deprecated `auth.getClaims(token)`** method (line 29 of index.ts). Per project memory, this causes **intermittent token validation failures** returning 401. The fix is to use `auth.getUser()` instead, which is stable and reliable.

**Secondary:** The edge function uses **subfolders** (`handlers/`, `lib/`) which can cause deployment issues with Lovable Cloud. All code must be in a single `index.ts`.

## Evidence
- Edge function logs show **zero entries** for `manage-machine` — the function may not even be booting correctly due to subfolder import resolution failures.
- The `schedule-post` function (recently created, single file) works fine.
- Memory note explicitly states: *"use `getUser()` instead of `getClaims()` to avoid intermittent token validation failures"*.

## Fix

Consolidate the entire `manage-machine` edge function into a single `index.ts` file with these changes:

1. **Replace `getClaims()`** with `getUser()`:
```typescript
// OLD (broken)
const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
const userId = claimsData.claims.sub;

// NEW (stable)
const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
const userId = user.id;
```

2. **Inline all handler code** from `handlers/*.ts` and `lib/helpers.ts` directly into `index.ts` — eliminating subfolders entirely.

3. **Delete subfolder files**: `handlers/`, `lib/` directories.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/manage-machine/index.ts` | Rewrite: inline all handlers + helpers, replace `getClaims` with `getUser` |
| `supabase/functions/manage-machine/handlers/*` | Delete all 6 files |
| `supabase/functions/manage-machine/lib/helpers.ts` | Delete |

No frontend changes needed — `manageMachineService.ts` calls the same function name with the same payload.

