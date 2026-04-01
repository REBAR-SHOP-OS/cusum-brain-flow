

# Apply: Strict SupabaseClient Type Fix

## Confirmed Type Alias (no `any`, no lint suppression needed)

```typescript
export type AppSupabaseClient = SupabaseClient<Record<string, unknown>, "public", Record<string, unknown>>;
```

No `deno-lint-ignore` comment — the alias uses `Record<string, unknown>`, not `any`.

## File 1: `supabase/functions/_shared/auth.ts`

1. **Line 6** — add `SupabaseClient` to import:
   ```typescript
   import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
   ```

2. **After line 12** — add exported type:
   ```typescript
   /** Concrete client type matching createClient(url, key) calls in edge functions. */
   export type AppSupabaseClient = SupabaseClient<Record<string, unknown>, "public", Record<string, unknown>>;
   ```

3. **Lines 14-18** — update `AuthResult`:
   ```typescript
   export interface AuthResult {
     userId: string;
     userClient: AppSupabaseClient;
     serviceClient: AppSupabaseClient;
   }
   ```

4. **Lines 88-91** — update `optionalAuthFull` return type:
   ```typescript
   export async function optionalAuthFull(req: Request): Promise<{
     userId: string;
     userClient: AppSupabaseClient;
   } | null> {
   ```

## File 2: `supabase/functions/_shared/requestHandler.ts`

1. **Line 14** — import `AppSupabaseClient`:
   ```typescript
   import { corsHeaders, requireAuth, optionalAuthFull, AppSupabaseClient } from "./auth.ts";
   ```

2. **Lines 24-25** — update `RequestContext`:
   ```typescript
     serviceClient: AppSupabaseClient;
     userClient: AppSupabaseClient | null;
   ```

3. **Line 77** — update local variable type:
   ```typescript
     let userClient: AppSupabaseClient | null = null;
   ```

## Scope
- 2 files, type-only changes
- Zero runtime behavior change
- No `any`, no `unknown` widening, no lint suppression
- After applying, build/type check will be run and exact result reported before audit

