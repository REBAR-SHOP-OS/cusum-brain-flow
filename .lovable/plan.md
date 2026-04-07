

# Fix: "Forbidden: requires one of [admin, marketing] roles" for Super Admins

## Root Cause

The `requireAnyRole()` function in `supabase/functions/_shared/roleCheck.ts` does a strict database lookup against the `user_roles` table — but has **no super admin bypass**. Compare with `requireSuperAdmin()` in the same file, which correctly checks `SUPER_ADMIN_EMAILS` as a fallback.

Super admins (sattar, radin, zahra) may not have an explicit `marketing` row in `user_roles`, so when they click "Regenerate" on a social post, the `regenerate-post` function's `requireAnyRole: ["admin", "marketing"]` guard rejects them with 403.

## Fix

### `supabase/functions/_shared/roleCheck.ts` — Add super admin bypass to `requireAnyRole`

Before the strict role check, look up the user's email and check against `SUPER_ADMIN_EMAILS`. If they're a super admin, return immediately (no throw).

```typescript
export async function requireAnyRole(
  serviceClient: { from: (table: string) => any },
  userId: string,
  roles: AppRole[],
): Promise<void> {
  // Super admin bypass — same pattern as requireSuperAdmin()
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  const email = (profile?.email ?? "").toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(email)) return;

  const has = await hasAnyRole(serviceClient, userId, roles);
  if (!has) {
    throw new Response(
      JSON.stringify({ error: `Forbidden: requires one of [${roles.join(", ")}] roles` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
```

Same bypass added to `requireRole()` for consistency.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/roleCheck.ts` | Add super admin email bypass to `requireRole()` and `requireAnyRole()` (~12 lines) |

## Impact
- Super admins can regenerate posts immediately
- All other `requireAnyRole` / `requireRole` guarded functions also get the bypass
- No database, UI, or schema changes
- Non-super-admin users still require explicit roles as before

