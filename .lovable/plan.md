

# Fix: extract-manifest Edge Function Returns Non-2xx

## Root Cause
`extract-manifest` is not listed in `supabase/config.toml`. Without `[functions.extract-manifest] verify_jwt = false`, the Supabase gateway performs its own JWT verification, which can reject valid tokens before the function code ever runs. Evidence: **zero logs** for this function — it never boots.

All other functions in the project (e.g., `ai-document-import`, `qa-war-engine`) have this config entry. `extract-manifest` was missed.

## Fix

### `supabase/config.toml`
Add the missing entry:
```toml
[functions.extract-manifest]
verify_jwt = false
```

This is a single-line config change. The function already handles its own authentication via `requireAuth()` from `_shared/auth.ts`, so disabling gateway JWT verification is safe and consistent with every other function in the project.

