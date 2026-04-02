

# Fix Build Error: AppSupabaseClient Type Mismatch

## Problem
`SupabaseClient` generic's third type parameter expects `string`, not `Record<string, unknown>`. This is a pre-existing type incompatibility in `supabase/functions/_shared/auth.ts` line 18.

## Fix
Change the `AppSupabaseClient` type alias to use `any` for flexibility, matching the actual return type of `createClient()`:

```typescript
export type AppSupabaseClient = ReturnType<typeof createClient>;
```

This resolves all 5+ cascading type errors in `auth.ts` and `requestHandler.ts` without changing any runtime behavior.

### Files changed
| File | Change |
|------|--------|
| `supabase/functions/_shared/auth.ts` | Fix `AppSupabaseClient` type alias |

Note: The `vizzyFullContext.ts` errors are separate pre-existing issues (using `{}` as index type) — not related to this change.

